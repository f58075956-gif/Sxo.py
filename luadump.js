// commands/luadump.js
'use strict';

const { analyzeScript }    = require('../core/analyzer');
const { rebuildLuac }      = require('../core/luac_rebuilder');
const { scanPayload }      = require('../security/payloadScanner');
const { sendError, sendFile, sendSuccess } = require('../utils/responder');
const { EmbedBuilder }     = require('discord.js');
const processingQueue      = require('../utils/queue');

module.exports = {
  name: 'luadump',
  description: 'Deobfuscate a script and reconstruct Lua 5.1 bytecode (.luac).',
  usage: '!luadump <code> | attach .lua file',

  async execute(ctx) {
    const { message, script } = ctx;
    if (!script) return sendError(message, 'Provide a Lua script inline or attach a file.');

    const { safe, threats } = scanPayload(script);
    if (!safe)
      return sendError(message, `⚠️ Dangerous payload detected.\n${threats.map(t => `• ${t.label}`).join('\n')}`);

    const thinking = await message.reply('⏳ Deobfuscating + rebuilding bytecode…');

    await processingQueue.add(async () => {
      try {
        // Full analysis with LUAC rebuild enabled
        const result = await analyzeScript(script, { buildLuac: true });

        await thinking.delete().catch(() => {});

        const embed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle('📦 Lua Bytecode Dump')
          .addFields(
            { name: 'Obfuscator',      value: `\`${result.obfuscatorName}\``, inline: true },
            { name: 'Layers Resolved', value: String(result.layers),          inline: true },
            { name: 'Source Size',     value: `${script.length} chars`,       inline: true },
          )
          .setTimestamp()
          .setFooter({ text: 'Lua Dumper Bot v2.0' });

        if (result.luacBytes) {
          embed.addFields({ name: 'Bytecode', value: `${result.luacBytes.length} bytes` });
        } else {
          embed.addFields({ name: 'Bytecode', value: '⚠️ Rebuild failed or luac not installed' });
        }

        await message.reply({ embeds: [embed] });

        // Send deobfuscated source
        if (result.beautified) {
          await sendFile(message, Buffer.from(result.beautified, 'utf8'), 'deobfuscated.lua', '📄 Deobfuscated source:');
        }

        // Send LUAC bytes
        if (result.luacBytes) {
          await sendFile(message, result.luacBytes, 'output.luac', '📦 LUAC bytecode:');
        }

      } catch (err) {
        await thinking.delete().catch(() => {});
        await sendError(message, `Lua dump failed: \`${err.message}\``);
      }
    });
  },
};
