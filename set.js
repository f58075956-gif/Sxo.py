// commands/set.js
'use strict';
const { QuickDB }    = require('quick.db');
const db             = new QuickDB({ filePath: process.env.DB_PATH || './data/db.sqlite' });
const { sendError, sendSuccess } = require('../utils/responder');

const ALLOWED_KEYS = {
  lang        : ['lua', 'text'],
  autobeautify: ['true', 'false'],
  verbose     : ['true', 'false'],
  defaultmode : ['deob', 'decode', 'luadump'],
};

module.exports = {
  name: 'set',
  description: 'Set a personal configuration value.',
  usage: '!set <key> <value>',
  async execute(ctx) {
    const { message, args } = ctx;
    const [key, val] = [args[0]?.toLowerCase(), args[1]?.toLowerCase()];

    if (!key || !val) return sendError(message, 'Usage: `!set <key> <value>`');
    if (!ALLOWED_KEYS[key]) return sendError(message, `Unknown key. Allowed: \`${Object.keys(ALLOWED_KEYS).join('`, `')}\``);
    if (!ALLOWED_KEYS[key].includes(val))
      return sendError(message, `Invalid value for \`${key}\`. Allowed: \`${ALLOWED_KEYS[key].join('`, `')}\``);

    await db.set(`config.${message.author.id}.${key}`, val);
    await sendSuccess(message, { title: '✅ Config Updated', description: `\`${key}\` → \`${val}\`` });
  },
};
