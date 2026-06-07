// security/banSystem.js
'use strict';

const { QuickDB } = require('quick.db');
const db          = new QuickDB({ filePath: process.env.DB_PATH || './data/db.sqlite' });
const logger      = require('../utils/logger');

/**
 * Check whether a user is currently banned.
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function checkBan(userId) {
  return !!(await db.get(`ban.${userId}`));
}

/**
 * Ban a user.
 * @param {string} userId
 * @param {string} reason
 * @param {string} bannedBy  – admin user ID
 */
async function banUser(userId, reason = 'No reason given', bannedBy = 'system') {
  await db.set(`ban.${userId}`, { reason, bannedBy, at: Date.now() });
  logger.info(`Banned user ${userId}: ${reason}`);
}

/**
 * Unban a user.
 * @param {string} userId
 */
async function unbanUser(userId) {
  await db.delete(`ban.${userId}`);
  logger.info(`Unbanned user ${userId}`);
}

/**
 * List all banned users.
 * @returns {Promise<Array<{ userId: string, reason: string, at: number }>>}
 */
async function listBans() {
  const all = (await db.get('ban')) || {};
  return Object.entries(all).map(([userId, data]) => ({ userId, ...data }));
}

module.exports = { checkBan, banUser, unbanUser, listBans };
