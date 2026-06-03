import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initHistory, addToHistory, getChannelHistory } from './history.js';
import { initUsers, registerUser, loginUser, getProfile, touchLastSeen, getUserPrefs, getSettings, updateSettings } from './users.js';
import { normalizeColor } from './colors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '../data');

const CHANNELS = {
  '28763': 'Городской сад',
  '28773': 'Квартал свиданий',
  '28774': 'Неадминистрируемый',
  '28775': 'Карточный домик',
  '28776': '(*) Закрытый канал',
};

function normalizeGender(gender) {
  return gender === 'f' ? 'f' : 'm';
}

function joinVerb(gender) {
  return gender === 'f' ? 'вошла' : 'вошёл';
}

function leaveVerb(gender) {
  return gender === 'f' ? 'вышла' : 'вышел';
}

initHistory(DATA_DIR);
initUsers(DATA_DIR);

const app = express();
app.use(express.static(join(__dirname, '../public')));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, version: '2.31' });
});

app.post('/api/register', (req, res) => {
  const result = registerUser(req.body);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/login', (req, res) => {
  const { name, password, channel } = req.body;
  if (!CHANNELS[channel]) {
    return res.status(400).json({ error: 'Выберите канал' });
  }
  const result = loginUser(name, password);
  if (result.error) return res.status(401).json(result);
  res.json({ ...result, channel });
});

app.get('/api/profile/:name', (req, res) => {
  const profile = getProfile(req.params.name);
  if (!profile) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json(profile);
});

app.post('/api/settings/load', (req, res) => {
  const { name, password } = req.body;
  const result = getSettings(name, password);
  if (result.error) return res.status(401).json(result);
  res.json(result);
});

app.post('/api/settings', (req, res) => {
  const { name, password, color, msgColor, coloredNames, coloredContent } = req.body;
  const result = updateSettings(name, password, {
    color, msgColor, coloredNames, coloredContent,
  });
  if (result.error) return res.status(401).json(result);
  res.json(result);
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Map();

function broadcast(channel, data, exclude) {
  for (const [ws, client] of clients) {
    if (client.channel === channel && ws !== exclude && ws.readyState === 1) {
      ws.send(JSON.stringify(data));
    }
  }
}

function getUsersInChannel(channel) {
  const users = [];
  for (const [, client] of clients) {
    if (client.channel === channel) {
      users.push({
        name: client.name,
        gender: client.gender,
        color: client.color,
        away: client.away,
      });
    }
  }
  return users.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

function sendUserList(channel) {
  broadcast(channel, { type: 'users', users: getUsersInChannel(channel) });
}

function makeMessage({ channel, nick, text, action, system, color, gender, msgColor, coloredContent }) {
  const now = Date.now();
  return {
    channel,
    ts: now,
    time: formatTime(new Date(now)),
    nick,
    text,
    action: !!action,
    system: !!system,
    color: color || '#000000',
    gender: gender || 'm',
    msgColor: msgColor || color || '#000000',
    coloredContent: !!coloredContent,
  };
}

function emitMessage(channel, payload, exclude) {
  broadcast(channel, { type: 'message', ...payload }, exclude);
}

function findClientByName(channel, nick) {
  const key = nick.trim().toLowerCase();
  for (const [ws, client] of clients) {
    if (client.channel === channel && client.name.toLowerCase() === key) return ws;
  }
  return null;
}

function sendWhisper(channel, fromClient, toName, text) {
  const payload = {
    type: 'whisper',
    time: formatTime(),
    from: fromClient.name,
    to: toName.trim(),
    text: text.trim(),
  };
  const targetWs = findClientByName(channel, toName);
  for (const [ws, client] of clients) {
    if (client.channel !== channel || ws.readyState !== 1) continue;
    if (ws === targetWs || client.name === fromClient.name) {
      ws.send(JSON.stringify(payload));
    }
  }
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === 'join') {
      const { name, channel } = msg;
      if (!name?.trim() || !CHANNELS[channel]) return;

      const trimmed = name.trim();
      const prefs = getUserPrefs(trimmed) || {};
      const gender = normalizeGender(prefs.gender ?? msg.gender);
      const color = normalizeColor(prefs.color ?? msg.color);

      clients.set(ws, {
        name: trimmed,
        channel,
        gender,
        color,
        msgColor: normalizeColor(prefs.msgColor ?? color),
        coloredNames: prefs.coloredNames !== false,
        coloredContent: !!prefs.coloredContent,
        away: false,
      });

      touchLastSeen(trimmed);

      ws.send(JSON.stringify({
        type: 'history',
        channel,
        channelName: CHANNELS[channel],
        messages: getChannelHistory(channel),
        users: getUsersInChannel(channel),
        prefs: {
          color,
          msgColor: normalizeColor(prefs.msgColor ?? color),
          coloredNames: prefs.coloredNames !== false,
          coloredContent: !!prefs.coloredContent,
        },
      }));
      emitMessage(channel, {
        time: formatTime(),
        nick: '***',
        text: `${trimmed} ${joinVerb(gender)} в чат`,
        system: true,
      });
      sendUserList(channel);
      return;
    }

    const client = clients.get(ws);
    if (!client) return;

    if (msg.type === 'message' && msg.text?.trim()) {
      const entry = makeMessage({
        channel: client.channel,
        nick: client.name,
        text: msg.text.trim(),
        action: msg.action,
        color: client.color,
        gender: client.gender,
        msgColor: client.msgColor,
        coloredContent: client.coloredContent,
      });
      addToHistory(entry);
      emitMessage(client.channel, {
        time: entry.time,
        nick: entry.nick,
        text: entry.text,
        action: entry.action,
        color: entry.color,
        gender: entry.gender,
        msgColor: entry.msgColor,
        coloredContent: entry.coloredContent,
      });
    }

    if (msg.type === 'whisper' && msg.to?.trim() && msg.text?.trim()) {
      sendWhisper(client.channel, client, msg.to, msg.text);
    }

    if (msg.type === 'away') {
      client.away = !!msg.away;
      sendUserList(client.channel);
    }

    if (msg.type === 'leave') {
      handleDisconnect(ws);
    }
  });

  ws.on('close', () => handleDisconnect(ws));
});

function handleDisconnect(ws) {
  const client = clients.get(ws);
  if (!client) return;
  clients.delete(ws);
  emitMessage(client.channel, {
    time: formatTime(),
    nick: '***',
    text: `${client.name} ${leaveVerb(client.gender)} из чата`,
    system: true,
  });
  sendUserList(client.channel);
}

function formatTime(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

server.listen(PORT, () => {
  console.log(`Мариупольский городской чат V2.31 — http://localhost:${PORT}`);
  console.log(`История: ${DATA_DIR} (хранение 7 дней)`);
});
