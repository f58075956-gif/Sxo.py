// handlers/twentyfivems.js  ──────────────────────────────────────────────────
'use strict';
const { Base64 } = require('js-base64');

// 25ms – partial support. Wraps Lua in table.concat(bytes) loadstring.
async function deobfuscate(script) {
  const concatRe = /table\.concat\s*\(\s*\{([^}]+)\}\s*\)/;
  const m = concatRe.exec(script);
  if (m) {
    const chars = m[1].split(',').map(s => {
      const n = parseInt(s.trim(), 10);
      return isNaN(n) ? '' : String.fromCharCode(n);
    });
    const result = chars.join('');
    if (/\b(local|function|return)\b/.test(result))
      return { output: result, changed: true, info: '25ms: table.concat byte array decoded' };
  }
  // Fallback: base64 blob
  const bm = /["']([A-Za-z0-9+/=]{40,})["']/.exec(script);
  if (bm) {
    try {
      const d = Base64.decode(bm[1]);
      if (/\b(local|function|return)\b/.test(d))
        return { output: d, changed: true, info: '25ms: base64 payload extracted (partial)' };
    } catch {}
  }
  return { output: script, changed: false, info: '25ms: unable to decode (partial support)' };
}
module.exports = { deobfuscate };
