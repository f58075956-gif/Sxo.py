// commands/obf.js
'use strict';

const { obfuscateStandard }           = require('../core/obfuscator');
const { sendChunked, sendError }      = require('../utils/responder');
const { scanPayload }                 = require('../security/payloadScanner');

module.exports = {
  name: 'obf',
  description: 'Standard Lua obfuscation (base64 + junk injection).',
  usage: '!obf <lua code>',

  async execute(ctx) {
    const { message, script } = ctx;
    if (!script) return sendError(message, 'Provide a Lua script to obfuscate.');

    const { safe, threats } = scanPayload(script);
    if (!safe) {
      return sendError(message, `⚠️ Refusing to obfuscate malicious payload.\n${threats.map(t=>`• ${t.label}`).join('\n')}`);
    }

    try {
      const obfuscated = obfuscateStandard(script);
      await sendChunked(message, obfuscated, { lang: 'lua', filename: 'obfuscated.lua' });
    } catch (err) {
      await sendError(message, `Obfuscation failed: \`${err.message}\``);
    }
  },
};
