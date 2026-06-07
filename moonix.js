// handlers/moonix.js
'use strict';
const { Base64 } = require('js-base64');

/**
 * Moonix Obfuscator v1.2
 * Uses a 3-pass encoding:
 *   1. string.byte array
 *   2. bit rotate by static amount
 *   3. base64 outer wrapper
 */

const ROTATE_RE = /rotate\s*\(\s*(\d+)\s*\)|rot\s*=\s*(\d+)/i;
const BYTES_RE  = /\{\s*(\d{1,3}(?:\s*,\s*\d{1,3})+)\s*\}/;

async function deobfuscate(script) {
  // Extract rotation amount
  const rotMatch = ROTATE_RE.exec(script);
  const rotate   = rotMatch ? parseInt(rotMatch[1] || rotMatch[2], 10) : 3;

  const bm = BYTES_RE.exec(script);
  if (bm) {
    const bytes = bm[1].split(',').map(s => parseInt(s.trim(), 10));
    // Reverse rotation: (byte - rotate) mod 256
    const decoded = bytes.map(b => ((b - rotate) + 256) & 0xFF);
    const str = Buffer.from(decoded).toString('utf8');
    if (/\b(local|function|return)\b/.test(str))
      return { output: str, changed: true, info: `Moonix: byte-rotate(-${rotate}) decoded` };
  }

  // Fallback: base64
  const blobRe = /["']([A-Za-z0-9+/=]{40,})["']/.exec(script);
  if (blobRe) {
    try {
      const d = Base64.decode(blobRe[1]);
      if (/\b(local|function|return)\b/.test(d))
        return { output: d, changed: true, info: 'Moonix: base64 outer layer removed' };
    } catch {}
  }

  return { output: script, changed: false, info: 'Moonix: no decodable payload found' };
}
module.exports = { deobfuscate };
