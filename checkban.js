// commands/checkban.js
'use strict';
const { banUser, unbanUser, listBans, checkBan } = require('../security/banSystem');
const { sendError, sendSuccess }                  = require('../utils/responder');
const { EmbedBuilder }                            = require('discord.js');

const ADMINS = () => (process.env.ADMIN_USER_IDS || '').split(',').map(s => s.trim());

module.exports = {
  name: 'checkban',
  description: 'Admin: check, apply, or remove bans.  Usage: !checkban [status|ban|unban|list] [userId] [reason]',
  usage: '!checkban <status|ban|unban|list> [userId] [reason]',

  async execute(ctx) {
    const { message, args } = ctx;

    const sub    = (args[0] || 'status').toLowerCase();
    const target = args[1];

    // Non-admin can only check their own ban status
    const isAdmin = ADMINS().includes(message.author.id);

    if (sub === 'status') {
      const uid    = isAdmin && target ? target : message.author.id;
      const banned = await checkBan(uid);
      return message.reply(banned ? `🚫 \`${uid}\` is **banned**.` : `✅ \`${uid}\` is **not** banned.`);
    }

    if (!isAdmin) return sendError(message, '🔒 Admin only.');

    if (sub === 'list') {
      const bans = await listBans();
      if (bans.length === 0) return message.reply('✅ No active bans.');
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle(`🚫 Banned Users (${bans.length})`)
        .setDescription(bans.map(b => `• \`${b.userId}\` – ${b.reason}`).join('\n'))
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (!target) return sendError(message, 'Provide a userId.');

    if (sub === 'ban') {
      const reason = args.slice(2).join(' ') || 'Banned by admin';
      await banUser(target, reason, message.author.id);
      return sendSuccess(message, { title: '🚫 User Banned', description: `\`${target}\` – ${reason}` });
    }

    if (sub === 'unban') {
      await unbanUser(target);
      return sendSuccess(message, { title: '✅ User Unbanned', description: `\`${target}\` has been unbanned.` });
    }

    return sendError(message, 'Unknown subcommand. Use `status | ban | unban | list`.');
  },
};
