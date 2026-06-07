// handlers/anonymous_net.js
'use strict';
const { Base64 } = require('js-base64');

// Anonymous.net v1 – two-pass: outer base64 + inner char-shift by fixed delta
const DELTA = 13; // ROT-13 variant on char codes

async function deobfuscate(script) {
  const blobRe = /["']([A-Za-z0-9+/=]{40,})["']/;
  const m = blobRe.exec(script);
  if (!m) return { output: script, changed: false, info: 'Anonymous.net: no blob found' };

  try {
    const raw = Base64.decode(m[1]);
    // Try plain first
    if (/\b(local|function|return)\b/.test(raw))
      return { output: raw, changed: true, info: 'Anonymous.net: base64 decoded' };

    // Apply char-shift
    const shifted = [...raw].map(c => String.fromCharCode(c.charCodeAt(0) - DELTA)).join('');
    if (/\b(local|function|return)\b/.test(shifted))
      return { output: shifted, changed: true, info: `Anonymous.net: base64 + shift(-${DELTA}) decoded` };
  } catch {}

  return { output: script, changed: false, info: 'Anonymous.net: decoding failed' };
}
module.exports = { deobfuscate };
