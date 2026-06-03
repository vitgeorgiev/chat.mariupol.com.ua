import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;

let dataFile = '';
let messages = [];

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function persist() {
  writeFileSync(dataFile, JSON.stringify(messages), 'utf8');
}

function prune() {
  const cutoff = Date.now() - RETENTION_MS;
  const before = messages.length;
  messages = messages.filter((m) => m.ts >= cutoff);
  if (messages.length !== before) persist();
}

export function initHistory(dataDir) {
  ensureDir(dataDir);
  dataFile = join(dataDir, 'history.json');

  if (existsSync(dataFile)) {
    try {
      messages = JSON.parse(readFileSync(dataFile, 'utf8'));
      if (!Array.isArray(messages)) messages = [];
    } catch {
      messages = [];
    }
  }

  prune();
  setInterval(prune, PRUNE_INTERVAL_MS);
}

export function addToHistory(entry) {
  messages.push(entry);
  persist();
}

export function getChannelHistory(channel) {
  const cutoff = Date.now() - RETENTION_MS;
  return messages
    .filter((m) => m.channel === channel && m.ts >= cutoff)
    .map(({ time, nick, text, action, system, color, gender, msgColor, coloredContent }) => ({
      time, nick, text, action, system, color, gender, msgColor, coloredContent,
    }));
}
