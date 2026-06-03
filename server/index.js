import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const CHANNELS = {
  '28763': 'Городской сад',
  '28773': 'Квартал свиданий',
  '28774': 'Неадминистрируемый',
  '28775': 'Карточный домик',
  '28776': '(*) Закрытый канал',
};

const app = express();
app.use(express.static(join(__dirname, '../public')));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, version: '2.31' });
});

app.post('/api/login', (req, res) => {
  const { name, channel } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Введите логин' });
  }
  if (!CHANNELS[channel]) {
    return res.status(400).json({ error: 'Выберите канал' });
  }
  res.json({ ok: true, name: name.trim(), channel });
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
    if (client.channel === channel) users.push(client.name);
  }
  return users.sort((a, b) => a.localeCompare(b, 'ru'));
}

function sendUserList(channel) {
  const users = getUsersInChannel(channel);
  broadcast(channel, { type: 'users', users });
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

      clients.set(ws, { name: name.trim(), channel });
      ws.send(JSON.stringify({
        type: 'history',
        channel,
        channelName: CHANNELS[channel],
        messages: [],
      }));
      broadcast(channel, {
        type: 'message',
        time: formatTime(),
        nick: '***',
        text: `${name.trim()} вошёл в чат`,
        system: true,
      });
      sendUserList(channel);
      return;
    }

    const client = clients.get(ws);
    if (!client) return;

    if (msg.type === 'message' && msg.text?.trim()) {
      broadcast(client.channel, {
        type: 'message',
        time: formatTime(),
        nick: client.name,
        text: msg.text.trim(),
      });
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
  broadcast(client.channel, {
    type: 'message',
    time: formatTime(),
    nick: '***',
    text: `${client.name} вышел из чата`,
    system: true,
  });
  sendUserList(client.channel);
}

function formatTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

server.listen(PORT, () => {
  console.log(`Мариупольский городской чат V2.31 — http://localhost:${PORT}`);
});
