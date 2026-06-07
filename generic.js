// handlers/generic.js
'use strict';

/**
 * Generic deobfuscation handler.
 *
 * Applied when no specific obfuscator is detected but the script
 * still appears obfuscated (high entropy, unusual patterns, etc.).
 *
 * Strategies attempted in order:
 *  1. Inline loadstring / load wrapping (base64 or hex)
 *  2. string.char(…) expansion
 *  3. Junk code removal + beautify pass
 */

const { Base64 }            = require('js-base64');
const { inlineLoadstrings } = require('../core/parser');
const logger                = require('../utils/logger');

async function deobfuscate(script, opts = {}) {
  let current = script;
  let changed  = false;
  const info   = [];

  // ── Pass 1: Inline base64 loadstrings ────────────────────────────────────
  const { result: pass1, resolved: r1 } = inlineLoadstrings(current);
  if (r1 > 0) {
    current = pass1;
    changed = true;
    info.push(`inlined ${r1} loadstring(s)`);
  }

  // ── Pass 2: Expand string.char(n, n, n, …) sequences ─────────────────────
  const pass2 = current.replace(
    /string\.char\s*\((\s*\d+(?:\s*,\s*\d+)*\s*)\)/g,
    (_, nums) => {
      const chars = nums.split(',').map(n => String.fromCharCode(parseInt(n.trim(), 10)));
      return JSON.stringify(chars.join(''));
    }
  );
  if (pass2 !== current) {
    current = pass2;
    changed = true;
    info.push('expanded string.char sequences');
  }

  // ── Pass 3: Hex string literals → UTF-8 ──────────────────────────────────
  const pass3 = current.replace(
    /"((?:\\x[0-9a-fA-F]{2}){4,})"/g,
    (_, hex) => {
      const bytes = hex.match(/\\x([0-9a-fA-F]{2})/g)
        .map(h => parseInt(h.slice(2), 16));
      return JSON.stringify(Buffer.from(bytes).toString('utf8'));
    }
  );
  if (pass3 !== current) {
    current = pass3;
    changed = true;
    info.push('decoded hex string literals');
  }

  return {
    output : current,
    changed,
    info   : info.join('; ') || 'generic: no transformations applied',
  };
}

module.exports = { deobfuscate };
