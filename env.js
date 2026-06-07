// commands/env.js
'use strict';
const { EmbedBuilder } = require('discord.js');
const { isWhitelisted } = require('../security/whitelist');

// Fields safe to display publicly
const PUBLIC_FIELDS = [
  'BOT_PREFIX', 'RATE_LIMIT_COMMANDS', 'RATE_LIMIT_WINDOW_MS',
  'QUEUE_CONCURRENCY', 'QUEUE_TIMEOUT_MS', 'MAX_SCRIPT_SIZE_KB',
  'SANDBOX_TIMEOUT_MS', 'ENABLE_SANDBOX', 'LOG_LEVEL',
];

module.exports = {
  name: 'env',
  description: 'Display the current runtime environment configuration.',
  usage: '!env',
  async execute(ctx) {
    const { message } = ctx;
    const isAdmin = (process.env.ADMIN_USER_IDS || '').split(',').includes(message.author.id);

    const fields = PUBLIC_FIELDS.map(k => ({
      name  : k,
      value : `\`${process.env[k] ?? 'unset'}\``,
      inline: true,
    }));

    if (isAdmin) {
      fields.push(
        { name: 'Node.js',  value: `\`${process.version}\``,              inline: true },
        { name: 'Platform', value: `\`${process.platform}\``,             inline: true },
        { name: 'Uptime',   value: `\`${Math.floor(process.uptime())}s\``, inline: true },
        { name: 'Memory',   value: `\`${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\``, inline: true },
      );
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('⚙️ Runtime Environment')
      .addFields(fields)
      .setTimestamp()
      .setFooter({ text: isAdmin ? 'Admin view' : 'Public view' });

    await message.reply({ embeds: [embed] });
  },
};
