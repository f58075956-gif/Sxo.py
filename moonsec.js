'use strict';

/**
 * Moonsec Deobfuscation Handler
 *
 * Moonsec works by:
 *   1. Building a numeric byte-array from string.byte / string.char calls
 *   2. XOR-ing it with a rotating key derived from a seed
 *   3. Executing the result via loadstring / load
 *
 * This handler:
 *   a. Extracts the byte array
 *   b. Extracts the XOR seed / key schedule
 *   c. Decodes the payload
 *   d. Validates the output looks like Lua
 *   e. Returns the decoded Lua string
 */

const logger = require('../utils/logger');

// ─── Patterns ─────────────────────────────────────────────────────────────────

// Matches the large numeric array: { 12, 34, 56, ... }
const BYTE_ARRAY_RE  = /\{\s*(\d{1,3}(?:\s*,\s*\d{1,3}){10,})\s*\}/;

// Matches bxor / bit.bxor calls – key indicators
const BXOR_RE        = /bxor\s*\(\s*(\w+)\s*,\s*(\d+)\s*\)|(\w+)\s*~\s*(\d+)/;

// Moonsec v2/v3 seed pattern: local SEED = <number>
const SEED_RE        = /local\s+(?:SEED|seed|_seed|_k)\s*=\s*(\d+)/i;

// Moonsec v3 uses a key schedule table
const KEY_TABLE_RE   = /local\s+(?:keys?|_keys?)\s*=\s*\{([^}]+)\}/i;

/**
 * Attempt to deobfuscate a Moonsec-obfuscated script.
 *
 * @param {string} script
 * @param {{ verbose?: boolean }} opts
 * @returns {{ output: string, changed: boolean, info: string }}
 */
async function deobfuscate(script, opts = {}) {

  // ── Step 1: Extract byte array ──────────────────────────────────────────────
  const arrMatch = BYTE_ARRAY_RE.exec(script);
  if (!arrMatch) {
    return { output: script, changed: false, info: 'Moonsec: byte array not found' };
  }

  const bytes = arrMatch[1].split(',').map(s => parseInt(s.trim(), 10));
  logger.debug(`[moonsec] found ${bytes.length} bytes`);

  // ── Step 2: Extract XOR key ─────────────────────────────────────────────────
  let keyBytes = _extractKey(script, bytes.length);
  if (!keyBytes) {
    logger.debug('[moonsec] falling back to heuristic key recovery');
    keyBytes = _heuristicKeyRecovery(bytes);
  }

  if (!keyBytes) {
    return { output: script, changed: false, info: 'Moonsec: could not recover XOR key' };
  }

  // ── Step 3: XOR decode ──────────────────────────────────────────────────────
  const decoded = Buffer.alloc(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    decoded[i] = (bytes[i] ^ keyBytes[i % keyBytes.length]) & 0xFF;
  }

  const result = decoded.toString('utf8');

  // ── Step 4: Validate output ─────────────────────────────────────────────────
  if (!_looksLikeLua(result)) {
    // Try reverse byte order as last resort
    bytes.reverse();
    const alt = Buffer.alloc(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      alt[i] = (bytes[i] ^ keyBytes[i % keyBytes.length]) & 0xFF;
    }
    const altStr = alt.toString('utf8');
    if (!_looksLikeLua(altStr)) {
      return { output: script, changed: false, info: 'Moonsec: decoded output is not valid Lua' };
    }
    return { output: altStr, changed: true, info: `Moonsec: decoded (reversed, key=${_keyDesc(keyBytes)})` };
  }

  return { output: result, changed: true, info: `Moonsec: decoded (key=${_keyDesc(keyBytes)})` };
}

// ─── Key extraction strategies ────────────────────────────────────────────────

function _extractKey(script, dataLen) {
  // Strategy A: explicit seed → LFSR key generation
  const seedMatch = SEED_RE.exec(script);
  if (seedMatch) {
    const seed = parseInt(seedMatch[1], 10);
    return _lfsrKeySchedule(seed, dataLen);
  }

  // Strategy B: pre-computed key table
  const ktMatch = KEY_TABLE_RE.exec(script);
  if (ktMatch) {
    const keys = ktMatch[1].split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    if (keys.length > 0) return keys;
  }

  // Strategy C: single-byte XOR – scan bxor for a literal
  const bxorMatch = BXOR_RE.exec(script);
  if (bxorMatch) {
    const k = parseInt(bxorMatch[2] || bxorMatch[4], 10);
    if (!isNaN(k)) return [k];
  }

  return null;
}

/**
 * Heuristic: try common Moonsec seeds (0–255) and pick the one that
 * produces the most Lua-keyword hits.
 */
function _heuristicKeyRecovery(bytes) {
  const LUA_KEYWORDS = ['local', 'function', 'return', 'end', 'if', 'then', 'do', 'for'];
  let best = null;
  let bestScore = 0;

  for (let k = 0; k < 256; k++) {
    const trial = Buffer.alloc(bytes.length);
    for (let i = 0; i < bytes.length; i++) trial[i] = (bytes[i] ^ k) & 0xFF;
    const s = trial.toString('utf8');
    const score = LUA_KEYWORDS.reduce((acc, kw) => acc + (s.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; best = [k]; }
  }

  return bestScore >= 3 ? best : null;
}

/**
 * Simple Fibonacci LFSR key schedule used by Moonsec v2.
 */
function _lfsrKeySchedule(seed, length) {
  const ks = [];
  let a = seed & 0xFF;
  let b = (seed >> 8) & 0xFF || 1;
  for (let i = 0; i < length; i++) {
    const next = (a + b) & 0xFF;
    ks.push(next);
    a = b;
    b = next;
  }
  return ks;
}

function _looksLikeLua(s) {
  const luaIndicators = /\b(local|function|return|end|if|then|do|for|while|repeat|until)\b/;
  return luaIndicators.test(s) && !/[\x00-\x08\x0B-\x0C\x0E-\x1F]{5,}/.test(s);
}

function _keyDesc(keyBytes) {
  if (keyBytes.length === 1) return `0x${keyBytes[0].toString(16).padStart(2, '0')}`;
  return `[${keyBytes.slice(0, 4).map(b => `0x${b.toString(16).padStart(2,'0')}`).join(', ')}${keyBytes.length > 4 ? '…' : ''}]`;
}

module.exports = { deobfuscate };
