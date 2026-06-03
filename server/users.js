import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash, randomBytes } from 'crypto';
import { zodiacSign } from './zodiac.js';
import { normalizeColor } from './colors.js';

let dataFile = '';
/** @type {Map<string, object>} */
let users = new Map();

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function persist() {
  writeFileSync(dataFile, JSON.stringify([...users.values()], null, 2), 'utf8');
}

function hashPassword(password, salt) {
  return createHash('sha256').update(`${salt}:${password}`).digest('hex');
}

function normalizeNick(nick) {
  return nick.trim();
}

function nickKey(nick) {
  return normalizeNick(nick).toLowerCase();
}

function verifyPassword(user, password) {
  return hashPassword(password, user.salt) === user.passwordHash;
}

export function initUsers(dataDir) {
  ensureDir(dataDir);
  dataFile = join(dataDir, 'users.json');
  if (existsSync(dataFile)) {
    try {
      const list = JSON.parse(readFileSync(dataFile, 'utf8'));
      if (Array.isArray(list)) {
        users = new Map(list.map((u) => {
          if (u.msgColor === undefined) u.msgColor = u.color || '#000000';
          if (u.coloredNames === undefined) u.coloredNames = true;
          if (u.coloredContent === undefined) u.coloredContent = false;
          return [nickKey(u.name), u];
        }));
      }
    } catch {
      users = new Map();
    }
  }
}

export function registerUser(data) {
  const name = normalizeNick(data.name);
  if (!name || name.length < 2 || name.length > 20) {
    return { error: 'Ник: от 2 до 20 символов' };
  }
  if (!/^[a-zA-Zа-яА-ЯёЁ0-9_.\-]+$/.test(name)) {
    return { error: 'Ник содержит недопустимые символы' };
  }
  const key = nickKey(name);
  if (users.has(key)) {
    return { error: 'Такой ник уже занят' };
  }
  if (!data.password || data.password.length < 4) {
    return { error: 'Пароль: минимум 4 символа' };
  }
  if (data.password !== data.password2) {
    return { error: 'Пароли не совпадают' };
  }

  const gender = data.gender === 'f' ? 'f' : 'm';
  const color = normalizeColor(data.color);
  const birthdate = data.birthdate || '';
  const salt = randomBytes(16).toString('hex');
  const now = Date.now();

  const user = {
    name,
    salt,
    passwordHash: hashPassword(data.password, salt),
    realName: (data.realName || '').trim().slice(0, 50),
    gender,
    birthdate,
    zodiac: zodiacSign(birthdate),
    email: (data.email || '').trim().slice(0, 50),
    about: (data.about || '').trim().slice(0, 230),
    color,
    msgColor: color,
    coloredNames: true,
    coloredContent: false,
    registeredAt: now,
    lastSeen: null,
  };

  users.set(key, user);
  persist();
  return { ok: true, user: publicProfile(user) };
}

export function loginUser(name, password) {
  const user = users.get(nickKey(name));
  if (!user) return { error: 'Неверный логин или пароль' };
  if (!verifyPassword(user, password)) {
    return { error: 'Неверный логин или пароль' };
  }
  return { ok: true, user: publicProfile(user) };
}

export function getProfile(name) {
  const user = users.get(nickKey(name));
  if (!user) return null;
  return publicProfile(user);
}

export function getSettings(name, password) {
  const user = users.get(nickKey(name));
  if (!user || !verifyPassword(user, password)) {
    return { error: 'Неверный логин или пароль' };
  }
  return { ok: true, settings: settingsPayload(user) };
}

export function updateSettings(name, password, data) {
  const key = nickKey(name);
  const user = users.get(key);
  if (!user || !verifyPassword(user, password)) {
    return { error: 'Неверный пароль' };
  }

  user.color = normalizeColor(data.color ?? user.color);
  user.msgColor = normalizeColor(data.msgColor ?? user.msgColor);
  user.coloredNames = data.coloredNames !== false;
  user.coloredContent = !!data.coloredContent;

  users.set(key, user);
  persist();
  return { ok: true, settings: settingsPayload(user), user: publicProfile(user) };
}

export function touchLastSeen(name) {
  const key = nickKey(name);
  const user = users.get(key);
  if (!user) return;
  user.lastSeen = Date.now();
  users.set(key, user);
  persist();
}

export function getUserPrefs(name) {
  const user = users.get(nickKey(name));
  if (!user) return null;
  return {
    gender: user.gender,
    color: user.color,
    msgColor: user.msgColor || user.color,
    coloredNames: user.coloredNames !== false,
    coloredContent: !!user.coloredContent,
  };
}

function settingsPayload(user) {
  return {
    color: user.color,
    msgColor: user.msgColor || user.color,
    coloredNames: user.coloredNames !== false,
    coloredContent: !!user.coloredContent,
  };
}

function publicProfile(user) {
  return {
    name: user.name,
    realName: user.realName,
    gender: user.gender,
    genderLabel: user.gender === 'f' ? 'женский' : 'мужской',
    birthdate: user.birthdate,
    zodiac: user.zodiac,
    email: user.email,
    about: user.about,
    color: user.color,
    msgColor: user.msgColor || user.color,
    coloredNames: user.coloredNames !== false,
    coloredContent: !!user.coloredContent,
    lastSeen: user.lastSeen,
    registeredAt: user.registeredAt,
  };
}
