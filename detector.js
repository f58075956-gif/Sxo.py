'use strict';

const { entropy } = require('../utils/entropy');

// ─── Obfuscator signatures ────────────────────────────────────────────────────
// Each entry: { name, patterns[], minPatternHits, handler }
// patterns: array of RegExp to match against the script.
// confidence is computed as (hits / patterns.length) * weight.

const SIGNATURES = [
  {
    name: 'Moonsec',
    weight: 1.0,
    patterns: [
      /local\s+[a-zA-Z_]+\s*=\s*\{[^}]{0,80}\}/,
      /string\.byte/,
      /string\.char/,
      /table\.concat/,
      /bit\.bxor|bxor\s*\(/,
      // Moonsec VM header comment
      /--\s*\[Moonsec\]/i,
      // Characteristic large numeric array
      /\{\s*\d{1,3}(?:\s*,\s*\d{1,3}){30,}/,
    ],
    minHits: 4,
  },
  {
    name: 'Luraph',
    weight: 1.0,
    patterns: [
      /--\s*Luraph Obfuscator/i,
      /LURAPH/i,
      /lp_[a-z0-9]+/i,
      // Luraph v13 numeric key pattern
      /local\s+[A-Za-z_]\w*\s*=\s*\d{6,}/,
      /pcall\s*\(\s*load\b/,
    ],
    minHits: 2,
  },
  {
    name: 'WeAreDevs',
    weight: 0.95,
    patterns: [
      /--\s*WeAreDevs/i,
      /WAD_/,
      /wad_key/i,
      /xor_key\s*=/i,
      /string\.rep\s*\(\s*["']\\0["']/,
    ],
    minHits: 2,
  },
  {
    name: 'LuaObfuscator',
    weight: 0.9,
    patterns: [
      /-- obfuscated with luaobfuscator/i,
      /LuaObfuscator/i,
      // Characteristic name munging: __a__b__ style
      /__[a-z]+__[a-z]+__/,
      /local\s+[_]{2,}\w+\s*=/,
    ],
    minHits: 2,
  },
  {
    name: 'iProtect',
    weight: 0.9,
    patterns: [
      /--\s*iProtect/i,
      /iProtect/i,
      /ip_[a-z]+\s*=/i,
      /local\s+[A-Z]{2,}\s*=\s*load\b/,
    ],
    minHits: 2,
  },
  {
    name: 'Nigalose',
    weight: 0.88,
    patterns: [
      /Nigalose/i,
      /nig_[a-z]+/i,
      /local\s+[a-z]{1,3}\s*=\s*\{\}/,
      /for\s+\w+\s*=\s*1\s*,\s*#[a-z]+\s+do/,
    ],
    minHits: 2,
  },
  {
    name: 'Ryzens',
    weight: 0.85,
    patterns: [
      /Ryzens/i,
      /ryz_[a-z]+/i,
      /local\s+[a-z_]+\s*=\s*string\.gsub/,
    ],
    minHits: 2,
  },
  {
    name: 'XHider',
    weight: 0.80,
    patterns: [
      /XHider/i,
      /xhide_/i,
      // XHider uses short base64 blobs
      /load\s*\(\s*[a-zA-Z_]+\s*\(["'][A-Za-z0-9+/=]{20,}["']\)/,
    ],
    minHits: 2,
  },
  {
    name: 'Anonymous.net',
    weight: 0.85,
    patterns: [
      /anonymous\.net/i,
      /anon_[a-z]+/i,
      /local\s+[a-z]{8,12}\s*=\s*[a-z]{8,12}\s*\(/,
    ],
    minHits: 2,
  },
  {
    name: '25ms',
    weight: 0.75,
    patterns: [
      /25ms/i,
      /-- 25ms obfuscator/i,
      /local\s+\w+\s*=\s*load\s*\(\s*table\.concat/,
    ],
    minHits: 2,
  },
  {
    name: 'Moonix',
    weight: 0.85,
    patterns: [
      /Moonix/i,
      /moonix_[a-z]+/i,
      /local\s+[a-z]{3}\s*=\s*\{\s*\}/,
      /\bVM\b.*\binstruction\b/i,
    ],
    minHits: 2,
  },
  {
    name: 'VirtualBox',
    weight: 0.88,
    patterns: [
      /VirtualBox/i,
      /vb_exec/i,
      /local\s+VM\s*=/,
      /opcodes\s*=/,
      /registers\s*=/,
    ],
    minHits: 2,
  },
];

// ─── Entropy thresholds ──────────────────────────────────────────────────────
// Scripts with entropy > 5.0 are likely obfuscated even without signature match.
const HIGH_ENTROPY_THRESHOLD = 5.0;

/**
 * Detects which obfuscator was used on the given script.
 *
 * @param {string} script
 * @returns {{ name: string, confidence: number, handler: string }}
 */
function detectObfuscator(script) {
  let best = { name: 'Unknown', confidence: 0, handler: 'generic' };

  for (const sig of SIGNATURES) {
    let hits = 0;
    for (const pattern of sig.patterns) {
      if (pattern.test(script)) hits++;
    }

    if (hits < sig.minHits) continue;

    const raw        = hits / sig.patterns.length;
    const confidence = Math.min(raw * sig.weight, 1.0);

    if (confidence > best.confidence) {
      best = {
        name       : sig.name,
        confidence,
        handler    : sig.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        hits,
      };
    }
  }

  // Entropy fallback: mark as "Generic Obfuscated" for high-entropy unknowns
  if (best.name === 'Unknown') {
    const e = entropy(script);
    if (e > HIGH_ENTROPY_THRESHOLD) {
      best = {
        name      : 'Generic (High Entropy)',
        confidence: Math.min((e - HIGH_ENTROPY_THRESHOLD) / 3, 0.6),
        handler   : 'generic',
        entropy   : e,
      };
    }
  }

  return best;
}

module.exports = { detectObfuscator, SIGNATURES };
