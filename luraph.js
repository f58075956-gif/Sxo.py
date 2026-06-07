// handlers/luraph.js
'use strict';

/**
 * Luraph v13 deobfuscator.
 *
 * Luraph embeds a Lua VM with numeric opcodes.  Full VM emulation is
 * extremely complex; this handler addresses the outer wrapping layers
 * (base64/XOR payload) and marks the inner VM code for human review.
 */

const { Base64 } = require('js-base64');

const LP_PAYLOAD_RE = /load\s*\(\s*["']([A-Za-z0-9+/=]{32,})["']\s*\)/;

async function deobfuscate(script) {
  // Attempt to extract the inner payload
  const m = LP_PAYLOAD_RE.exec(script);
  if (m) {
    try {
      const decoded = Base64.decode(m[1]);
      if (/\blocal\b|\bfunction\b|\breturn\b/.test(decoded)) {
        return { output: decoded, changed: true, info: 'Luraph: extracted base64 payload' };
      }
    } catch {}
  }
  return { output: script, changed: false, info: 'Luraph: outer payload not extractable (VM core – manual review required)' };
}

module.exports = { deobfuscate };
