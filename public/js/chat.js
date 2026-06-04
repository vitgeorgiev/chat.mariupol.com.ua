import { applySmileys, escapeHtml, renderSmileys } from './smileys.js';
import { genderIcon, isCustomIcon, normalizeColor } from './color-cube.js';

const CHANNEL_NAMES = {
  '28763': 'Городской сад',
  '28773': 'Квартал свиданий',
  '28774': 'Неадминистрируемый',
  '28775': 'Карточный домик',
  '28776': '(*) Закрытый канал',
};

const CHANNEL_NAMES_LOCATIVE = {
  '28763': 'Городском саду',
  '28773': 'Квартале свиданий',
  '28774': 'Неадминистрируемом',
  '28775': 'Карточном домике',
  '28776': 'Закрытом канале',
};

const params = new URLSearchParams(window.location.search);
const name = params.get('name');
let channel = params.get('channel');
const gender = params.get('gender') === 'f' ? 'f' : 'm';
const color = normalizeColor(params.get('color'));

let prefs = {
  color,
  msgColor: normalizeColor(params.get('msgColor') || params.get('color')),
  coloredNames: params.get('coloredNames') !== '0',
  coloredContent: params.get('coloredContent') === '1',
};

if (!name || !channel) {
  window.location.href = '/';
}

document.title = `${CHANNEL_NAMES[channel] || 'Чат'} — Мариупольский городской чат V2.31`;
const channelLocativeEl = document.getElementById('channel-locative-side');
if (channelLocativeEl) {
  channelLocativeEl.textContent = CHANNEL_NAMES_LOCATIVE[channel] || 'чате';
}
const mChannelLabel = document.getElementById('m-channel-label');
if (mChannelLabel) {
  mChannelLabel.textContent = CHANNEL_NAMES[channel] || 'чат';
}
document.getElementById('channel-select').value = channel;
document.getElementById('my-info-link').href =
  `/profile.html?name=${encodeURIComponent(name)}`;
document.getElementById('settings-link').href =
  `/settings.html?name=${encodeURIComponent(name)}&channel=${encodeURIComponent(channel)}&gender=${gender}`;

let ws;
let away = false;
let historyHasMore = false;
let historyOldestTs = null;
let historyLoading = false;

const messagesEl = document.getElementById('messages');
const usersEl = document.getElementById('users');
const awayUsersEl = document.getElementById('away-users');
const awayHeaderEl = document.getElementById('away-header');
const textInput = document.getElementById('text-input');
const tempOutLink = document.getElementById('temp-out-link');

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.onopen = () => {
    const announce = sessionStorage.getItem('mgch_announce_join') === '1';
    if (announce) sessionStorage.removeItem('mgch_announce_join');
    ws.send(JSON.stringify({
      type: 'join', name, channel, gender, color, announce,
    }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'history') {
      messagesEl.innerHTML = '';
      historyHasMore = !!data.hasMore;
      historyOldestTs = data.oldestTs ?? null;
      historyLoading = false;
      if (data.prefs) prefs = { ...prefs, ...data.prefs };
      data.messages.forEach((m) => appendMessage(m, false));
      messagesEl.scrollTop = messagesEl.scrollHeight;
      if (data.users) updateUsers(data.users);
    }
    if (data.type === 'historyMore') {
      prependHistory(data.messages);
      historyHasMore = !!data.hasMore;
      historyOldestTs = data.oldestTs ?? historyOldestTs;
      historyLoading = false;
    }
    if (data.type === 'users') updateUsers(data.users);
    if (data.type === 'message') addMessage(data);
    if (data.type === 'whisper') addWhisper(data);
  };

  ws.onclose = () => setTimeout(connect, 2000);
}

function createMessageRow({ time, nick, text, system, action, color: nickCol, msgColor }) {
  const row = document.createElement('div');
  row.className = 'msg-row';

  if (system) {
    row.innerHTML =
      `<span class="msg-system">&gt;&gt;&gt; ${esc(text)} (${esc(time)})</span>`;
  } else {
    const nameClass = action ? 'colname colname-action' : 'colname';
    const textClass = action ? 'coltext coltext-action' : 'coltext';
    const senderNickColor = normalizeColor(nickCol);
    const nickColor = prefs.coloredNames ? senderNickColor : '#000000';
    const textColor = prefs.coloredContent
      ? normalizeColor(msgColor || nickCol)
      : null;

    let nickStyle;
    let textStyle;
    let timeStyle;
    if (action) {
      const actionStyle = ` style="color:${senderNickColor}"`;
      nickStyle = actionStyle;
      textStyle = actionStyle;
      timeStyle = actionStyle;
      row.classList.add('msg-row-action');
    } else {
      nickStyle = ` style="color:${nickColor}"`;
      textStyle = textColor ? ` style="color:${textColor}"` : '';
      timeStyle = textStyle;
    }

    const nickPart = action
      ? `<span class="${nameClass}"><a class="nick"${nickStyle} href="#" data-nick="${esc(nick)}">${esc(nick)}</a></span> `
      : `<span class="${nameClass}"><a class="nick"${nickStyle} href="#" data-nick="${esc(nick)}">${esc(nick)}</a>:</span> `;

    row.innerHTML =
      `<span class="msg-bullet">•</span> ` +
      nickPart +
      `<span class="${textClass}"${textStyle} data-raw="${escAttr(text)}">${renderMessageText(text)}</span> ` +
      `<span class="time"${timeStyle}>(${esc(time)})</span>`;
    row.querySelector('.nick')?.addEventListener('click', (e) => {
      e.preventDefault();
      insertNick(nick);
    });
  }

  return row;
}

function appendMessage(msg, scroll = true) {
  messagesEl.appendChild(createMessageRow(msg));
  if (scroll) messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addMessage(msg) {
  appendMessage(msg, true);
}

function prependHistory(batch) {
  if (!batch?.length) return;
  const prevHeight = messagesEl.scrollHeight;
  const frag = document.createDocumentFragment();
  batch.forEach((m) => frag.appendChild(createMessageRow(m)));
  messagesEl.insertBefore(frag, messagesEl.firstChild);
  messagesEl.scrollTop = messagesEl.scrollHeight - prevHeight;
}

function loadOlderHistory() {
  if (historyLoading || !historyHasMore || !historyOldestTs) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  historyLoading = true;
  ws.send(JSON.stringify({ type: 'loadHistory', beforeTs: historyOldestTs }));
}

function addWhisper({ time, from, to, text }) {
  const row = document.createElement('div');
  row.className = 'msg-row';
  const label = from === name
    ? `шепчете ${to}`
    : `${from} шепчет вам`;
  row.innerHTML =
    `<span class="msg-whisper">* ${esc(label)}: ${renderSmileys(text)} (${esc(time)})</span>`;
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderUserLine(u, dimmed) {
  const cls = dimmed ? 'user-line user-away' : 'user-line';
  const nickColor = prefs.coloredNames ? esc(u.color) : '#000000';
  const iconCls = 'gender-icon' + (isCustomIcon(u.name) ? ' gender-icon-custom' : '');
  return `<div class="${cls}">` +
    `<span class="user-left"><img src="${genderIcon(u.gender, u.name)}" width="12" height="16" alt="" class="${iconCls}"></span>` +
    `<span class="user-nick-wrap"><a class="nick" href="#" data-nick="${esc(u.name)}" style="color:${nickColor}">${esc(u.name)}</a></span>` +
    `<span class="user-actions">` +
    `<img src="/i/icon-whisper.svg" width="14" height="14" alt="шепнуть" title="шепнуть" data-whisper="${esc(u.name)}">` +
    `<img src="/i/icon-bench.svg" width="14" height="10" alt="инфо" title="инфо" data-profile="${esc(u.name)}">` +
    `<img src="/i/icon-smile.svg" width="14" height="14" alt=":)" title=":)" data-smile="${esc(u.name)}">` +
    `</span></div>`;
}

function updateUsers(users) {
  const active = users.filter((u) => !u.away);
  const absent = users.filter((u) => u.away);
  const htmlActive = active.map((u) => renderUserLine(u, false)).join('');
  const htmlAbsent = absent.map((u) => renderUserLine(u, true)).join('');

  if (usersEl) usersEl.innerHTML = htmlActive;
  if (awayUsersEl) awayUsersEl.innerHTML = htmlAbsent;
  if (awayHeaderEl) awayHeaderEl.hidden = absent.length === 0;

  const drawerUsers = document.getElementById('drawer-users');
  const drawerAway = document.getElementById('drawer-away-users');
  const drawerAwayHdr = document.getElementById('drawer-away-header');
  if (drawerUsers) drawerUsers.innerHTML = htmlActive;
  if (drawerAway) drawerAway.innerHTML = htmlAbsent;
  if (drawerAwayHdr) drawerAwayHdr.hidden = absent.length === 0;

  const drawerLabel = document.getElementById('drawer-users-label');
  if (drawerLabel) drawerLabel.textContent = `участники (${active.length})`;

  const mCount = document.getElementById('m-parts-count');
  if (mCount) mCount.textContent = String(active.length);

  bindUserEvents();
}

function bindUserEvents() {
  const nickSelector = '#users .nick, #away-users .nick, #drawer-users .nick, #drawer-away-users .nick';
  document.querySelectorAll(nickSelector).forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      insertNick(el.dataset.nick);
    });
  });
  document.querySelectorAll('[data-whisper]').forEach((el) => {
    el.addEventListener('click', () => {
      setWhisperTo(el.dataset.whisper);
      focusWhisperText();
      if (isMobileLayout()) openDrawer('whisper');
    });
  });
  document.querySelectorAll('[data-profile]').forEach((el) => {
    el.addEventListener('click', () => {
      window.open(`/profile.html?name=${encodeURIComponent(el.dataset.profile)}`, '_blank');
    });
  });
  document.querySelectorAll('[data-smile]').forEach((el) => {
    el.addEventListener('click', () => {
      setWhisperTo(el.dataset.smile);
      setWhisperText(':) ');
      focusWhisperText();
      if (isMobileLayout()) openDrawer('whisper');
    });
  });
}

function isMobileLayout() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function whisperToInput() {
  return document.getElementById('whisper-to') || document.getElementById('whisper-to-drawer');
}

function whisperTextInput() {
  return document.getElementById('whisper-text') || document.getElementById('whisper-text-drawer');
}

function setWhisperTo(val) {
  [document.getElementById('whisper-to'), document.getElementById('whisper-to-drawer')].forEach((el) => {
    if (el && el.value !== val) el.value = val;
  });
}

function setWhisperText(val) {
  [document.getElementById('whisper-text'), document.getElementById('whisper-text-drawer')].forEach((el) => {
    if (el && el.value !== val) el.value = val;
  });
}

function focusWhisperText() {
  (whisperTextInput() || textInput)?.focus();
}

function actionChecked() {
  const main = document.getElementById('action-check');
  const drawer = document.getElementById('action-check-drawer');
  return !!(main?.checked || drawer?.checked);
}

function insertNick(nick) {
  textInput.value = `${nick}, ${textInput.value}`;
  textInput.focus();
}

function esc(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function escAttr(text) {
  return esc(text).replace(/"/g, '&quot;');
}

function highlightNicks(html) {
  if (!name) return html;
  const reNick = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${reNick})(,)`, 'gi');
  return html.replace(
    re,
    '<span class="msg-nick-mention">$1</span>,',
  );
}

function renderMessageText(text) {
  return applySmileys(highlightNicks(escapeHtml(text)));
}

function sendMessage(e) {
  e?.preventDefault();
  const text = textInput.value.trim();
  if (!text || !ws || ws.readyState !== WebSocket.OPEN || away) return;
  ws.send(JSON.stringify({
    type: 'message',
    text,
    action: actionChecked(),
  }));
  textInput.value = '';
  textInput.focus();
}

function sendWhisper(e) {
  e?.preventDefault();
  const to = whisperToInput()?.value.trim();
  const text = whisperTextInput()?.value.trim();
  if (!to || !text || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'whisper', to, text }));
  setWhisperText('');
  closeDrawer();
}

function toRus() {
  const chars =
    ' !Э№;%?э()*+б-ю.0123456789ЖжБ=Ю,"ФИСВУАПРШОЛДЬТЩЗЙКЫЕГМЦЧНЯх/ъ:_ёфисвуапршолдьтщзйкыегмцчняХ\\ЪЁ';
  let str = '';
  for (let i = 0; i < textInput.value.length; i++) {
    const ch = textInput.value.charCodeAt(i);
    str += ch < 0x80 ? chars.charAt(ch - 0x20) : textInput.value.charAt(i);
  }
  textInput.value = str;
  textInput.focus();
}

function toggleAway() {
  away = !away;
  tempOutLink?.classList.toggle('active-away', away);
  document.querySelectorAll('#drawer-menu .mbtn[data-away]').forEach((el) => {
    el.classList.toggle('active-away', away);
  });
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'away', away }));
  }
}

function chatQuery(extra = {}) {
  const q = new URLSearchParams({
    name,
    channel,
    gender,
    color: prefs.color || color,
    msgColor: prefs.msgColor,
    coloredNames: prefs.coloredNames ? '1' : '0',
    coloredContent: prefs.coloredContent ? '1' : '0',
    ...extra,
  });
  return q;
}

function switchChannel() {
  const newChannel = document.getElementById('channel-select').value;
  if (newChannel === channel) return;
  window.location.href = `/chat.html?${chatQuery({ channel: newChannel })}`;
}

document.getElementById('query-form').addEventListener('submit', sendMessage);
document.getElementById('whisper-form')?.addEventListener('submit', sendWhisper);
document.getElementById('whisper-form-drawer')?.addEventListener('submit', sendWhisper);
document.getElementById('rus-btn')?.addEventListener('click', toRus);
document.getElementById('rus-btn-drawer')?.addEventListener('click', toRus);
document.getElementById('reset-btn')?.addEventListener('click', () => setTimeout(() => textInput.focus(), 0));
document.getElementById('reset-btn-drawer')?.addEventListener('click', () => setTimeout(() => textInput.focus(), 0));
tempOutLink?.addEventListener('click', (e) => { e.preventDefault(); toggleAway(); });
document.getElementById('channel-go')?.addEventListener('click', switchChannel);

const channelRoot = document.getElementById('channel-switch-root');
const channelSlotHeader = document.getElementById('channel-slot-header');
const channelSlotDrawer = document.getElementById('channel-slot-drawer');

function placeChannelSwitch() {
  if (!channelRoot || !channelSlotHeader || !channelSlotDrawer) return;
  const slot = isMobileLayout() ? channelSlotDrawer : channelSlotHeader;
  if (channelRoot.parentElement !== slot) slot.appendChild(channelRoot);
  channelRoot.hidden = false;
}

placeChannelSwitch();
window.addEventListener('resize', placeChannelSwitch);

const drawerMenu = document.getElementById('drawer-menu');
if (drawerMenu) {
  document.querySelectorAll('.header-nav a').forEach((link) => {
    const a = document.createElement('a');
    a.className = 'mbtn';
    a.href = link.getAttribute('href') || '#';
    a.textContent = link.textContent.trim();
    if (link.id === 'temp-out-link') {
      a.href = '#';
      a.dataset.away = '1';
      a.addEventListener('click', (e) => { e.preventDefault(); toggleAway(); closeDrawer(); });
    } else if (link.id === 'settings-link' || link.id === 'my-info-link') {
      a.href = link.href;
    }
    drawerMenu.appendChild(a);
  });
}

const chatDrawer = document.getElementById('chat-drawer');
const chatScrim = document.getElementById('chat-scrim');

function openDrawer(focus) {
  document.body.classList.add('chat-drawer-open');
  if (chatDrawer) {
    chatDrawer.setAttribute('aria-hidden', 'false');
  }
  if (chatScrim) chatScrim.setAttribute('aria-hidden', 'false');
  if (focus === 'whisper') {
    setTimeout(() => whisperTextInput()?.focus(), 200);
  }
}

function closeDrawer() {
  document.body.classList.remove('chat-drawer-open');
  if (chatDrawer) chatDrawer.setAttribute('aria-hidden', 'true');
  if (chatScrim) chatScrim.setAttribute('aria-hidden', 'true');
}

document.getElementById('m-burger')?.addEventListener('click', () => openDrawer());
document.getElementById('m-roompill')?.addEventListener('click', () => openDrawer());
document.getElementById('m-parts')?.addEventListener('click', () => openDrawer());
document.getElementById('drawer-close')?.addEventListener('click', closeDrawer);
chatScrim?.addEventListener('click', closeDrawer);

const actionMain = document.getElementById('action-check');
const actionDrawer = document.getElementById('action-check-drawer');
function syncAction(from, to) {
  if (from && to) to.checked = from.checked;
}
actionMain?.addEventListener('change', () => syncAction(actionMain, actionDrawer));
actionDrawer?.addEventListener('change', () => syncAction(actionDrawer, actionMain));

function syncWhisperFields(e) {
  const id = e.target.id;
  if (id === 'whisper-to' || id === 'whisper-to-drawer') {
    setWhisperTo(e.target.value);
  }
  if (id === 'whisper-text' || id === 'whisper-text-drawer') {
    setWhisperText(e.target.value);
  }
}
['whisper-to', 'whisper-to-drawer', 'whisper-text', 'whisper-text-drawer'].forEach((id) => {
  document.getElementById(id)?.addEventListener('input', syncWhisperFields);
});

messagesEl.addEventListener('scroll', () => {
  if (messagesEl.scrollTop < 60) loadOlderHistory();
});

textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage(e);
  }
});

document.querySelectorAll('.exit-form').forEach((form) => {
  form.addEventListener('submit', () => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'leave' }));
    }
  });
});

textInput.focus();
connect();

export { toRus, sendMessage };
