// commands/obf2.js
'use strict';
const { obfuscateAdvanced }       = require('../core/obfuscator');
const { sendChunked, sendError }  = require('../utils/responder');
const { scanPayload }             = require('../security/payloadScanner');

module.exports = {
  name: 'obf2',
  description: 'Advanced obfuscation: XOR byte array + VM-style dispatcher.',
  usage: '!obf2 <lua code>',
  async execute(ctx) {
    const { message, script } = ctx;
    if (!script) return sendError(message, 'Provide a Lua script.');
    const { safe, threats } = scanPayload(script);
    if (!safe) return sendError(message, `⚠️ Malicious payload.\n${threats.map(t=>`• ${t.label}`).join('\n')}`);
    try {
      const result = obfuscateAdvanced(script);
      await sendChunked(message, result, { lang: 'lua', filename: 'obfuscated_adv.lua' });
    } catch (err) {
      await sendError(message, `Advanced obfuscation failed: \`${err.message}\``);
    }
  },
};
