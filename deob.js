// commands/deob.js
'use strict';

const { analyzeScript }              = require('../core/analyzer');
const { scanPayload, stripMaliciousPatterns } = require('../security/payloadScanner');
const { sendAnalysisEmbed, sendError, sendChunked } = require('../utils/responder');
const processingQueue                = require('../utils/queue');

module.exports = {
  name: 'deob',
  description: 'Full multi-layer deobfuscation of a Lua script.',
  usage: '!deob <code> | attach .lua file',

  async execute(ctx) {
    const { message, script } = ctx;

    if (!script) {
      return sendError(message, 'Provide a Lua script inline or attach a `.lua` / `.txt` file.');
    }

    // Security scan first
    const { safe, threats } = scanPayload(script);
    if (!safe) {
      const list = threats.map(t => `• ${t.label}`).join('\n');
      return sendError(message, `⚠️ **Dangerous payload detected – processing aborted.**\n${list}`);
    }

    const thinking = await message.reply('⏳ Analyzing…');

    await processingQueue.add(async () => {
      try {
        const result = await analyzeScript(script, { buildLuac: false, verbose: false });
        await thinking.delete().catch(() => {});
        await sendAnalysisEmbed(message, result);
      } catch (err) {
        await thinking.delete().catch(() => {});
        await sendError(message, `Analysis failed: \`${err.message}\``);
      }
    });
  },
};
