// handlers/ryzens.js
'use strict';
const { Base64 } = require('js-base64');
async function deobfuscate(script) {
  // Ryzens uses string.gsub with a character-shift cipher
  const shiftRe = /string\.gsub\s*\([^,]+,\s*["'](.+?)["']\s*,\s*["'](.+?)["']\)/g;
  let out = script;
  let changed = false;
  out = out.replace(shiftRe, (m, pat, rep) => { changed = true; return `"${rep}"`; });
  if (!changed) {
    // Fallback: base64 blob
    const blobRe = /["']([A-Za-z0-9+/=]{40,})["']/;
    const bm = blobRe.exec(script);
    if (bm) {
      try {
        const d = Base64.decode(bm[1]);
        if (/\b(local|function)\b/.test(d)) return { output: d, changed: true, info: 'Ryzens: base64 decoded' };
      } catch {}
    }
  }
  return changed
    ? { output: out, changed: true, info: 'Ryzens: gsub pattern resolved' }
    : { output: script, changed: false, info: 'Ryzens: no match' };
}
module.exports = { deobfuscate };
