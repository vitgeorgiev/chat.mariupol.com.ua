import {
  normalizeColor,
  renderColorCube,
  renderColorPreview,
} from './color-cube.js';

const params = new URLSearchParams(window.location.search);
const name = params.get('name') || '';
const channel = params.get('channel') || '28763';
const gender = params.get('gender') || 'm';

if (!name) {
  window.location.href = '/';
}

document.getElementById('settings-nick').textContent = name;
document.getElementById('back-link').href =
  `/chat.html?name=${encodeURIComponent(name)}&channel=${encodeURIComponent(channel)}&gender=${gender}&color=${encodeURIComponent(params.get('color') || '#000000')}`;

let nickColor = '#000000';
let msgColor = '#000000';

const nickPreview = document.getElementById('nick-preview');
const msgPreview = document.getElementById('msg-preview');
const nickInput = document.getElementById('nick-color');
const msgInput = document.getElementById('msg-color');

function applyNickColor(c) {
  nickColor = c;
  nickInput.value = c;
  renderColorPreview(nickPreview, name, c);
}

function applyMsgColor(c) {
  msgColor = c;
  msgInput.value = c;
  msgPreview.textContent = 'Пример текста';
  msgPreview.style.color = c;
  msgPreview.style.fontWeight = 'normal';
  msgPreview.style.fontSize = '12px';
}

renderColorCube(document.getElementById('nick-cube'), nickColor, applyNickColor);
renderColorCube(document.getElementById('msg-cube'), msgColor, applyMsgColor);
applyNickColor(nickColor);
applyMsgColor(msgColor);

document.getElementById('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('error');
  const successEl = document.getElementById('success');
  errorEl.hidden = true;
  successEl.hidden = true;

  const password = document.getElementById('settings-password').value;
  const body = {
    name,
    password,
    color: nickColor,
    msgColor,
    coloredNames: document.getElementById('colored-names').checked,
    coloredContent: document.getElementById('colored-content').checked,
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || 'Ошибка сохранения';
      errorEl.hidden = false;
      return;
    }
    successEl.textContent = 'Настройки сохранены!';
    successEl.hidden = false;
    document.getElementById('settings-password').value = '';
    setTimeout(() => {
      const q = new URLSearchParams({
        name,
        channel,
        gender: data.user.gender,
        color: data.user.color,
        msgColor: data.user.msgColor,
        coloredNames: data.user.coloredNames !== false ? '1' : '0',
        coloredContent: data.user.coloredContent ? '1' : '0',
      });
      window.location.href = `/chat.html?${q}`;
    }, 800);
  } catch {
    errorEl.textContent = 'Ошибка соединения';
    errorEl.hidden = false;
  }
});

async function loadSettings() {
  const password = sessionStorage.getItem('mgch_pwd');
  if (!password) return;

  try {
    const res = await fetch('/api/settings/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password }),
    });
    if (!res.ok) return;
    const data = await res.json();
    nickColor = normalizeColor(data.settings.color);
    msgColor = normalizeColor(data.settings.msgColor);
    document.getElementById('colored-names').checked = data.settings.coloredNames;
    document.getElementById('colored-content').checked = data.settings.coloredContent;
    renderColorCube(document.getElementById('nick-cube'), nickColor, applyNickColor);
    renderColorCube(document.getElementById('msg-cube'), msgColor, applyMsgColor);
    applyNickColor(nickColor);
    applyMsgColor(msgColor);
  } catch { /* ignore */ }
}

loadSettings();
