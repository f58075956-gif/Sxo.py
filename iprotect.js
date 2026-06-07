// handlers/iprotect.js
'use strict';
const { Base64 } = require('js-base64');

async function deobfuscate(script) {
  // iProtect wraps payload in load(base64) with a numeric XOR key
  const keyRe = /local\s+[A-Z]{2,}\s*=\s*(\d+)/;
  const blobRe = /["']([A-Za-z0-9+/=]{40,})["']/;
  const km = keyRe.exec(script);
  const bm = blobRe.exec(script);
  if (km && bm) {
    try {
      const key = parseInt(km[1], 10) & 0xFF;
      const raw = Buffer.from(Base64.decode(bm[1]), 'binary');
      const out = Buffer.alloc(raw.length);
      for (let i = 0; i < raw.length; i++) out[i] = raw[i] ^ key;
      const decoded = out.toString('utf8');
      if (_lua(decoded)) return { output: decoded, changed: true, info: `iProtect: XOR key=0x${key.toString(16)}` };
    } catch {}
  }
  return { output: script, changed: false, info: 'iProtect: extraction failed' };
}
function _lua(s) { return /\b(local|function|return|end)\b/.test(s); }
module.exports = { deobfuscate };
