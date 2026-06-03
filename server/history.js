import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export const HISTORY_PAGE_SIZE = 100;

let dataFile = '';
let messages = [];

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function persist() {
  writeFileSync(dataFile, JSON.stringify(messages), 'utf8');
}

function serializeMessage(m) {
  return {
    time: m.time,
    nick: m.nick,
    text: m.text,
    action: m.action,
    system: m.system,
    color: m.color,
    gender: m.gender,
    msgColor: m.msgColor,
    coloredContent: m.coloredContent,
  };
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
}

export function addToHistory(entry) {
  messages.push(entry);
  persist();
}

export function getChannelHistory(channel, { beforeTs, limit = HISTORY_PAGE_SIZE } = {}) {
  let list = messages.filter((m) => m.channel === channel);
  if (beforeTs) {
    list = list.filter((m) => m.ts < beforeTs);
  }
  list.sort((a, b) => a.ts - b.ts);

  const hasMore = list.length > limit;
  const page = list.slice(-limit);
  const oldestTs = page.length ? page[0].ts : null;

  return {
    messages: page.map(serializeMessage),
    hasMore,
    oldestTs,
  };
}
