// handlers/wearedevs.js
'use strict';

/**
 * WeAreDevs deobfuscator.
 * WAD uses a simple XOR against a hard-coded key string + base64 outer layer.
 */

const { Base64 } = require('js-base64');

const WAD_KEY_RE   = /(?:xor_key|wad_key|WAD_KEY)\s*=\s*["']([^"']+)["']/i;
const WAD_BLOB_RE  = /["']([A-Za-z0-9+/=]{40,})["']/g;

async function deobfuscate(script) {
  const keyMatch = WAD_KEY_RE.exec(script);
  const key = keyMatch ? keyMatch[1] : null;

  const changed_blobs = [];

  const result = script.replace(WAD_BLOB_RE, (match, blob) => {
    try {
      const decoded = Base64.decode(blob);
      if (key) {
        const xored = _xorString(decoded, key);
        if (_looksLikeLua(xored)) { changed_blobs.push(blob.slice(0, 12) + '…'); return JSON.stringify(xored); }
      }
      if (_looksLikeLua(decoded)) { changed_blobs.push(blob.slice(0, 12) + '…'); return JSON.stringify(decoded); }
    } catch {}
    return match;
  });

  if (changed_blobs.length > 0) {
    return { output: result, changed: true, info: `WeAreDevs: decoded ${changed_blobs.length} blob(s)` };
  }
  return { output: script, changed: false, info: 'WeAreDevs: no decodable blobs found' };
}

function _xorString(str, key) {
  const out = [];
  for (let i = 0; i < str.length; i++) out.push(String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length)));
  return out.join('');
}

function _looksLikeLua(s) {
  return /\b(local|function|return|end|if|then)\b/.test(s);
}

module.exports = { deobfuscate };
