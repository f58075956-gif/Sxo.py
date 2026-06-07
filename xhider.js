// handlers/xhider.js
'use strict';
const { Base64 } = require('js-base64');

// XHider: small scripts, single base64 blob inside load()
async function deobfuscate(script) {
  const blobRe = /load\s*\(\s*[a-zA-Z_]\w*\s*\(\s*["']([A-Za-z0-9+/=]{20,})["']\s*\)\s*\)/;
  const m = blobRe.exec(script);
  if (m) {
    try {
      const decoded = Base64.decode(m[1]);
      if (/\b(local|function|return|end)\b/.test(decoded))
        return { output: decoded, changed: true, info: 'XHider: single-layer base64 extracted' };
    } catch {}
  }
  // Plain load(base64)
  const plain = /load\s*\(\s*["']([A-Za-z0-9+/=]{20,})["']\s*\)/.exec(script);
  if (plain) {
    try {
      const decoded = Base64.decode(plain[1]);
      if (/\b(local|function|return|end)\b/.test(decoded))
        return { output: decoded, changed: true, info: 'XHider: plain load() base64 extracted' };
    } catch {}
  }
  return { output: script, changed: false, info: 'XHider: payload not extractable' };
}
module.exports = { deobfuscate };
