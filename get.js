// commands/get.js
'use strict';
const { QuickDB }    = require('quick.db');
const db             = new QuickDB({ filePath: process.env.DB_PATH || './data/db.sqlite' });
const { sendError }  = require('../utils/responder');
const { EmbedBuilder } = require('discord.js');

const ALLOWED_KEYS = ['lang', 'autobeautify', 'verbose', 'defaultmode'];

module.exports = {
  name: 'get',
  description: 'Retrieve a stored user configuration value.',
  usage: '!get <key>',
  async execute(ctx) {
    const { message, args } = ctx;
    const key = (args[0] || '').toLowerCase();
    if (!key) return sendError(message, `Usage: \`!get <key>\`\nAllowed keys: ${ALLOWED_KEYS.join(', ')}`);
    if (!ALLOWED_KEYS.includes(key)) return sendError(message, `Unknown key. Allowed: \`${ALLOWED_KEYS.join('`, `')}\``);

    const val = await db.get(`config.${message.author.id}.${key}`);
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📋 Config Value')
      .addFields(
        { name: 'Key',   value: `\`${key}\``,            inline: true },
        { name: 'Value', value: `\`${val ?? 'not set'}\``, inline: true },
      )
      .setTimestamp();
    await message.reply({ embeds: [embed] });
  },
};
