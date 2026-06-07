// commands/unset.js
'use strict';
const { QuickDB }    = require('quick.db');
const db             = new QuickDB({ filePath: process.env.DB_PATH || './data/db.sqlite' });
const { sendError, sendSuccess } = require('../utils/responder');

module.exports = {
  name: 'unset',
  description: 'Remove a personal configuration value.',
  usage: '!unset <key>',
  async execute(ctx) {
    const { message, args } = ctx;
    const key = args[0]?.toLowerCase();
    if (!key) return sendError(message, 'Usage: `!unset <key>`');
    await db.delete(`config.${message.author.id}.${key}`);
    await sendSuccess(message, { title: '🗑️ Config Cleared', description: `\`${key}\` has been unset.` });
  },
};
