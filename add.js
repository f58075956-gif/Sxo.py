// commands/add.js
'use strict';
const { addWhitelist, removeWhitelist, listWhitelist } = require('../security/whitelist');
const { sendError, sendSuccess }                        = require('../utils/responder');
const { EmbedBuilder }                                  = require('discord.js');

const ADMINS = () => (process.env.ADMIN_USER_IDS || '').split(',').map(s => s.trim());

module.exports = {
  name: 'add',
  description: 'Admin: manage the whitelist. Usage: !add [add|remove|list] [userId]',
  usage: '!add <add|remove|list> [userId]',

  async execute(ctx) {
    const { message, args } = ctx;
    if (!ADMINS().includes(message.author.id))
      return sendError(message, '🔒 Admin only.');

    const sub    = (args[0] || '').toLowerCase();
    const target = args[1];

    if (sub === 'list') {
      const wl = await listWhitelist();
      if (wl.length === 0) return message.reply('📋 Whitelist is empty.');
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle(`✅ Whitelist (${wl.length})`)
        .setDescription(wl.map(u => `• \`${u.userId}\` (added by \`${u.addedBy}\`)`).join('\n'))
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (!target) return sendError(message, 'Provide a userId.');

    if (sub === 'add') {
      await addWhitelist(target, message.author.id);
      return sendSuccess(message, { title: '✅ Whitelisted', description: `\`${target}\` added to whitelist.` });
    }

    if (sub === 'remove') {
      await removeWhitelist(target);
      return sendSuccess(message, { title: '🗑️ Removed', description: `\`${target}\` removed from whitelist.` });
    }

    return sendError(message, 'Usage: `!add <add|remove|list> [userId]`');
  },
};
