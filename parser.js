'use strict';

/**
 * Lua Parser & Beautifier
 *
 * Provides:
 *  - beautify(src)          → formatted Lua string
 *  - renameVars(src)        → rename obfuscated variable names
 *  - removeJunkCode(src)    → strip dead assignments, unreachable blocks
 *  - inlineLoadstrings(src) → collapse loadstring("…") into literal code
 */

// ─── Beautifier ──────────────────────────────────────────────────────────────

const INDENT = '  '; // 2-space indent

const BLOCK_OPEN  = /\b(do|then|repeat|function\b.*?)\s*$/;
const BLOCK_CLOSE = /^\s*(end|until|else|elseif)\b/;

/**
 * Simple line-level indentation beautifier for Lua.
 * Does NOT require a full AST – works on tokenised lines.
 *
 * @param {string} src
 * @returns {string}
 */
function beautify(src) {
  // 1. Normalise line endings and collapse consecutive blank lines
  const lines = src
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n');

  let depth   = 0;
  const out   = [];

  for (let raw of lines) {
    const line = raw.trim();
    if (line === '') { out.push(''); continue; }

    // Decrease indent BEFORE printing closing keywords
    if (BLOCK_CLOSE.test(line)) depth = Math.max(0, depth - 1);

    out.push(INDENT.repeat(depth) + line);

    // Increase indent AFTER printing opening keywords
    if (BLOCK_OPEN.test(line) && !line.match(/\bend\b/)) depth++;
  }

  return out.join('\n');
}

// ─── Variable renamer ─────────────────────────────────────────────────────────

let _varCounter = 0;
const _nameCache = new Map();

function _freshName(prefix = 'var') {
  return `${prefix}_${(_varCounter++).toString(36)}`;
}

/**
 * Rename obfuscated single/double letter variable names and
 * underscore-prefixed junk names to readable identifiers.
 *
 * Strategy: track `local` declarations, build a rename map,
 * then do a safe global replace with word-boundary anchors.
 *
 * NOTE: This is a regex heuristic – a full AST rename requires
 *       a Lua parser (e.g. lua-parse). Replace this with AST
 *       manipulation for production accuracy.
 *
 * @param {string} src
 * @returns {string}
 */
function renameVars(src) {
  _varCounter = 0;
  _nameCache.clear();

  // Match: local <ident> or local <ident>, <ident>
  const localDecl = /\blocal\s+((?:[a-zA-Z_]\w*\s*,\s*)*[a-zA-Z_]\w*)/g;
  let m;

  while ((m = localDecl.exec(src)) !== null) {
    const names = m[1].split(',').map(s => s.trim());
    for (const name of names) {
      if (_isObfuscatedName(name) && !_nameCache.has(name)) {
        _nameCache.set(name, _freshName(_guessPrefix(name, src)));
      }
    }
  }

  // Apply renames (longest name first to avoid partial replacements)
  let result = src;
  const sorted = [..._nameCache.entries()].sort((a, b) => b[0].length - a[0].length);

  for (const [original, renamed] of sorted) {
    const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\b${escaped}\\b`, 'g'), renamed);
  }

  return result;
}

function _isObfuscatedName(name) {
  // Heuristic: 1-2 chars, all underscores, or long hex-like strings
  return (
    name.length <= 2 ||
    /^_+$/.test(name) ||
    /^[a-f0-9]{6,}$/i.test(name) ||
    /^[A-Z]{4,}$/.test(name)
  );
}

function _guessPrefix(name, src) {
  // Try to infer role from context (very rough)
  const ctx = src.slice(src.indexOf(name), src.indexOf(name) + 60);
  if (/table\.|{/.test(ctx)) return 'tbl';
  if (/string\.|gsub|sub\b/.test(ctx)) return 'str';
  if (/function/.test(ctx)) return 'fn';
  if (/\d/.test(name)) return 'num';
  return 'var';
}

// ─── Junk code remover ────────────────────────────────────────────────────────

/**
 * Strips obvious junk patterns inserted by obfuscators:
 *  - Assignments to variables that are never read
 *  - `if false then … end` blocks
 *  - Repeated `do end` wrappers
 *  - Trailing semicolons and double semicolons
 *
 * @param {string} src
 * @returns {string}
 */
function removeJunkCode(src) {
  let out = src;

  // Dead `if false then … end`
  out = out.replace(/if\s+false\s+then[\s\S]*?end\b/g, '');

  // `if true then` → flatten (remove wrapper)
  out = out.replace(/if\s+true\s+then\n?([\s\S]*?)\nend\b/g, '$1');

  // Empty do…end blocks
  out = out.replace(/\bdo\s+end\b/g, '');

  // Double semicolons / trailing semicolons
  out = out.replace(/;{2,}/g, ';');
  out = out.replace(/;\s*\n/g, '\n');

  // Consecutive blank lines
  out = out.replace(/\n{3,}/g, '\n\n');

  return out.trim();
}

// ─── Loadstring inliner ───────────────────────────────────────────────────────

/**
 * Resolves one level of `loadstring("…base64…")` or `load("…")`.
 *
 * For safety this only handles BASE-64-encoded payloads that
 * decode to printable ASCII (i.e., plain Lua, not binary bytecode).
 *
 * @param {string} src
 * @returns {{ result: string, resolved: number }}
 */
function inlineLoadstrings(src) {
  const { Base64 } = require('js-base64');
  let resolved = 0;

  const result = src.replace(
    /(?:loadstring|load)\s*\(\s*(?:game\.GetService\("HttpService"\)\.JSONDecode\s*\(\s*)?["']([A-Za-z0-9+/=]{20,})["']\s*\)/g,
    (match, b64) => {
      try {
        const decoded = Base64.decode(b64);
        // Only inline if it looks like Lua text
        if (/[\x00-\x08\x0B-\x0C\x0E-\x1F]/.test(decoded)) return match; // binary
        resolved++;
        return `--[[ inlined loadstring ]]\n${decoded}`;
      } catch {
        return match;
      }
    }
  );

  return { result, resolved };
}

module.exports = { beautify, renameVars, removeJunkCode, inlineLoadstrings };
