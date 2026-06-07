// commands/moonsec.js
'use strict';

const moonsecHandler       = require('../handlers/moonsec');
const { rebuildLuac }      = require('../core/luac_rebuilder');
const { beautify }         = require('../core/parser');
const { scanPayload }      = require('../security/payloadScanner');
const { sendError, sendFile, sendAnalysisEmbed } = require('../utils/responder');
const { EmbedBuilder }     = require('discord.js');
const processingQueue      = require('../utils/queue');
const logger               = require('../utils/logger');

module.exports = {
  name: 'moonsec',
  description: 'Specialized Moonsec deobfuscation with XOR key recovery + LUAC reconstruction.',
  usage: '!moonsec <code> | attach .lua file',

  async execute(ctx) {
    const { message, script } = ctx;
    if (!script) return sendError(message, 'Provide a Moonsec-obfuscated Lua script.');

    const { safe, threats } = scanPayload(script);
    if (!safe)
      return sendError(message, `⚠️ Dangerous payload.\n${threats.map(t => `• ${t.label}`).join('\n')}`);

    const thinking = await message.reply('🔓 Running Moonsec decoder…');

    await processingQueue.add(async () => {
      try {
        const start  = Date.now();
        const result = await moonsecHandler.deobfuscate(script, { verbose: true });
        const elapsed = Date.now() - start;

        await thinking.delete().catch(() => {});

        if (!result.changed) {
          return sendError(message, `Moonsec decoder failed: ${result.info}`);
        }

        const beautified = beautify(result.output);

        // Try LUAC reconstruction
        let luacBytes = null;
        try {
          luacBytes = await rebuildLuac(result.output, { source: '@moonsec' });
        } catch (e) {
          logger.debug('[moonsec cmd] LUAC rebuild failed:', e.message);
        }

        // Summary embed
        const embed = new EmbedBuilder()
          .setColor(0xEB459E)
          .setTitle('🌙 Moonsec Deobfuscation Complete')
          .addFields(
            { name: 'Result',       value: result.info,                           inline: false },
            { name: 'Output Size',  value: `${result.output.length} chars`,       inline: true  },
            { name: 'Time',         value: `${elapsed}ms`,                        inline: true  },
            { name: 'LUAC Rebuilt', value: luacBytes ? `${luacBytes.length} bytes` : 'No (luac not found)', inline: true },
          )
          .setTimestamp()
          .setFooter({ text: 'Lua Dumper Bot v2.0 – Moonsec Engine' });

        await message.reply({ embeds: [embed] });
        await sendFile(message, Buffer.from(beautified, 'utf8'), 'moonsec_decoded.lua', '📄 Decoded source:');
        if (luacBytes) {
          await sendFile(message, luacBytes, 'moonsec_rebuilt.luac', '📦 Reconstructed LUAC:');
        }

      } catch (err) {
        await thinking.delete().catch(() => {});
        logger.error('[moonsec cmd]', err);
        await sendError(message, `Moonsec processing error: \`${err.message}\``);
      }
    });
  },
};
