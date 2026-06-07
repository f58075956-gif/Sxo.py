// commands/decode.js
'use strict';

const { Base64 }                = require('js-base64');
const { inlineLoadstrings }     = require('../core/parser');
const { sendChunked, sendError, sendSuccess } = require('../utils/responder');

module.exports = {
  name: 'decode',
  description: 'Decode a single-layer encoded Lua script (base64, hex, string.char).',
  usage: '!decode <encoded string or script>',

  async execute(ctx) {
    const { message, script } = ctx;
    if (!script) return sendError(message, 'Provide an encoded string or Lua script.');

    const attempts = [];

    // ── Attempt 1: raw base64 ─────────────────────────────────────────────
    try {
      const d = Base64.decode(script.trim());
      if (/[\x20-\x7E\n\r\t]{10,}/.test(d)) {
        attempts.push({ label: 'Base64', result: d });
      }
    } catch {}

    // ── Attempt 2: hex string (0x or plain) ────────────────────────────────
    const hexClean = script.trim().replace(/\s+/g, '').replace(/^0x/i, '');
    if (/^[0-9a-fA-F]+$/.test(hexClean) && hexClean.length % 2 === 0) {
      const d = Buffer.from(hexClean, 'hex').toString('utf8');
      if (/[\x20-\x7E]{5,}/.test(d)) attempts.push({ label: 'Hex', result: d });
    }

    // ── Attempt 3: loadstring inline ──────────────────────────────────────
    const { result: ls, resolved } = inlineLoadstrings(script);
    if (resolved > 0) attempts.push({ label: `Loadstring (${resolved} layer(s))`, result: ls });

    // ── Attempt 4: string.char(…) expansion ──────────────────────────────
    const charExp = script.replace(
      /string\.char\s*\((\s*\d+(?:\s*,\s*\d+)*\s*)\)/g,
      (_, nums) => JSON.stringify(nums.split(',').map(n => String.fromCharCode(+n.trim())).join(''))
    );
    if (charExp !== script) attempts.push({ label: 'string.char expansion', result: charExp });

    if (attempts.length === 0) {
      return sendError(message, 'Could not decode the input with any known method.');
    }

    // Return best attempt (first valid one)
    const best = attempts[0];
    await message.reply(`✅ **Decoded via ${best.label}** (${attempts.length} method(s) succeeded)`);
    await sendChunked(message, best.result, { lang: 'lua', filename: 'decoded.lua' });
  },
};
