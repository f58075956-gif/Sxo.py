// commands/help.js
'use strict';
const { EmbedBuilder } = require('discord.js');
const { sendError }    = require('../utils/responder');

const PREFIX = process.env.BOT_PREFIX || '!';

const CATEGORIES = {
  'Core': ['deob', 'obf', 'obf2', 'decode', 'luadump', 'unluac', 'moonsec', 'loadstring'],
  'Utility': ['ping', 'log', 'env', 'get', 'set', 'unset'],
  'Admin': ['checkban', 'add'],
};

module.exports = {
  name: 'help',
  description: 'Show all commands or detailed info about one command.',
  usage: '!help [command]',

  async execute(ctx) {
    const { message, args, client } = ctx;
    const target = args[0]?.toLowerCase();

    // ── Single command detail ─────────────────────────────────────────────
    if (target) {
      const cmd = client.commandMap.get(target);
      if (!cmd) return sendError(message, `Unknown command: \`${target}\``);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`📖 ${PREFIX}${target}`)
        .setDescription(cmd.description || 'No description.')
        .addFields({ name: 'Usage', value: `\`${cmd.usage || PREFIX + target}\`` })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // ── Full command list ─────────────────────────────────────────────────
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🛠️ Lua Dumper Bot — Command Reference')
      .setDescription(
        `Prefix: \`${PREFIX}\`   •   Attach \`.lua\` or \`.txt\` files to most commands.\n` +
        `Use \`${PREFIX}help <command>\` for detailed usage.`
      )
      .setTimestamp()
      .setFooter({ text: 'Lua Dumper Bot v2.0' });

    for (const [category, names] of Object.entries(CATEGORIES)) {
      const lines = names.map(name => {
        const cmd = client.commandMap.get(name);
        return cmd ? `\`${PREFIX}${name}\` – ${cmd.description}` : null;
      }).filter(Boolean);

      if (lines.length > 0) {
        embed.addFields({ name: `__${category}__`, value: lines.join('\n'), inline: false });
      }
    }

    await message.reply({ embeds: [embed] });
  },
};
