// handlers/luaobfuscator.js
'use strict';
const { Base64 }            = require('js-base64');
const { renameVars,
        removeJunkCode }    = require('../core/parser');

/**
 * LuaObfuscator.com handler.
 *
 * LuaObfuscator applies:
 *  - Variable / function name mangling (__a__b__ style)
 *  - String encoding (base64 table, per-char XOR)
 *  - Dead code injection
 *  - Control-flow flattening (switch-like dispatch tables)
 */

const ENCODED_STR_RE = /\b([a-zA-Z_]\w*)\s*\[\s*(\d+)\s*\]/g;  // table[N] constant refs
const DISPATCH_RE    = /while\s+true\s+do[\s\S]*?break[\s\S]*?end/g;

async function deobfuscate(script) {
  let out = script;
  let changed = false;
  const notes = [];

  // ── Pass 1: Rename mangled variables ────────────────────────────────────
  const renamed = renameVars(out);
  if (renamed !== out) { out = renamed; changed = true; notes.push('vars renamed'); }

  // ── Pass 2: Remove junk / dead code ─────────────────────────────────────
  const cleaned = removeJunkCode(out);
  if (cleaned !== out) { out = cleaned; changed = true; notes.push('junk removed'); }

  // ── Pass 3: Flatten control-flow dispatch loops ──────────────────────────
  // Very basic: strip while true do … break end wrappers
  const flatOut = out.replace(DISPATCH_RE, m => {
    // Extract the body between while true do … break … end
    const body = m
      .replace(/^while\s+true\s+do\s*/, '')
      .replace(/\s*break\s*end\s*$/, '')
      .trim();
    return body;
  });
  if (flatOut !== out) { out = flatOut; changed = true; notes.push('dispatch loops flattened'); }

  return {
    output  : out,
    changed,
    info    : changed ? `LuaObfuscator: ${notes.join(', ')}` : 'LuaObfuscator: no passes applied',
  };
}
module.exports = { deobfuscate };
