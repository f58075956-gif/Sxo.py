// security/whitelist.js
'use strict';

const { QuickDB } = require('quick.db');
const db = new QuickDB({ filePath: process.env.DB_PATH || './data/db.sqlite' });

async function isWhitelisted(userId) {
  // Admins are always allowed
  const admins = (process.env.ADMIN_USER_IDS || '').split(',').map(s => s.trim());
  if (admins.includes(userId)) return true;
  return !!(await db.get(`whitelist.${userId}`));
}

async function addWhitelist(userId, addedBy = 'system') {
  await db.set(`whitelist.${userId}`, { addedBy, at: Date.now() });
}

async function removeWhitelist(userId) {
  await db.delete(`whitelist.${userId}`);
}

async function listWhitelist() {
  const all = (await db.get('whitelist')) || {};
  return Object.entries(all).map(([userId, data]) => ({ userId, ...data }));
}

module.exports = { isWhitelisted, addWhitelist, removeWhitelist, listWhitelist };
