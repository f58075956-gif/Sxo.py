// commands/log.js
'use strict';
const fs   = require('fs');
const path = require('path');
const { sendChunked, sendError } = require('../utils/responder');

const LOG_DIR = process.env.LOG_DIR || './logs';

module.exports = {
  name: 'log',
  description: 'Display the last N lines of the combined execution log.',
  usage: '!log [lines=30]',
  async execute(ctx) {
    const { message, args } = ctx;
    const n = Math.min(parseInt(args[0]) || 30, 100);
    const logFile = path.join(LOG_DIR, 'combined.log');

    if (!fs.existsSync(logFile))
      return sendError(message, 'Log file not found. Ensure `LOG_TO_FILE=true` in `.env`.');

    const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean);
    const tail  = lines.slice(-n).join('\n');

    await sendChunked(message, tail, { lang: 'text', filename: 'bot.log' });
  },
};
