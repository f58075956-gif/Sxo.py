'use strict';

/**
 * LUAC Rebuilder
 *
 * Reconstructs Lua 5.1 binary bytecode from a deobfuscated source string.
 *
 * Two strategies are attempted in order:
 *  1. Shell-out to the real `luac` binary (if installed).
 *  2. Pure-JS minimal Lua 5.1 bytecode emitter (simplified, for demonstration).
 *
 * The output is a Buffer containing raw LUAC bytes ready to write to a .luac file.
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const logger = require('../utils/logger');

// ─── Lua 5.1 binary header constants ─────────────────────────────────────────
const LUA_SIGNATURE   = Buffer.from([0x1B, 0x4C, 0x75, 0x61]); // \x1BLua
const LUA_VERSION     = 0x51;   // Lua 5.1
const LUA_FORMAT      = 0x00;   // official format
const LUA_ENDIAN      = 0x01;   // little-endian
const LUA_INT_SIZE    = 0x04;
const LUA_SIZE_T      = 0x04;
const LUA_INSTR_SIZE  = 0x04;
const LUA_NUM_SIZE    = 0x08;
const LUA_INT_FLAG    = 0x00;   // floating-point numbers

/**
 * Attempts to produce LUAC bytes for the given Lua source string.
 *
 * @param {string} source       Lua source code
 * @param {{ source?: string }} opts
 * @returns {Promise<Buffer>}
 */
async function rebuildLuac(source, opts = {}) {
  // ── Strategy 1: real luac binary ──────────────────────────────────────────
  try {
    const buf = await compileWithBinary(source);
    logger.debug('[luac_rebuilder] compiled via luac binary');
    return buf;
  } catch (binErr) {
    logger.debug('[luac_rebuilder] luac binary unavailable – falling back to JS emitter:', binErr.message);
  }

  // ── Strategy 2: JS bytecode emitter (Lua 5.1 header + stub function) ──────
  try {
    const buf = emitLuac51(source, opts.source || '@input');
    logger.debug('[luac_rebuilder] emitted via JS emitter');
    return buf;
  } catch (emitErr) {
    throw new Error(`LUAC rebuild failed: ${emitErr.message}`);
  }
}

// ─── Strategy 1: shell-out to luac ──────────────────────────────────────────

async function compileWithBinary(source) {
  const tmpSrc  = path.join(os.tmpdir(), `ldb_src_${Date.now()}.lua`);
  const tmpOut  = path.join(os.tmpdir(), `ldb_out_${Date.now()}.luac`);

  try {
    fs.writeFileSync(tmpSrc, source, 'utf8');

    await execFileAsync('luac', ['-o', tmpOut, tmpSrc], {
      timeout: 5000,
      // Restrict environment for security
      env: { PATH: '/usr/bin:/usr/local/bin' },
    });

    return fs.readFileSync(tmpOut);
  } finally {
    for (const f of [tmpSrc, tmpOut]) {
      try { fs.unlinkSync(f); } catch {}
    }
  }
}

// ─── Strategy 2: Minimal Lua 5.1 bytecode emitter ────────────────────────────
//
// This emits a syntactically valid LUAC file whose top-level function chunk
// embeds the original source as a LOAD K (string constant) + RETURN sequence.
// It is NOT a full compiler – think of it as a "bytecode container" that
// a real Lua VM can load and whose disassembly reveals the original source.
//
// For full compilation, integrate luaparse + a code-gen backend.

function emitLuac51(source, chunkName) {
  const parts = [];

  // ── Header (18 bytes) ────────────────────────────────────────────────────
  parts.push(LUA_SIGNATURE);
  parts.push(Buffer.from([
    LUA_VERSION, LUA_FORMAT, LUA_ENDIAN,
    LUA_INT_SIZE, LUA_SIZE_T, LUA_INSTR_SIZE, LUA_NUM_SIZE, LUA_INT_FLAG,
  ]));

  // ── Top-level function prototype ─────────────────────────────────────────
  parts.push(encodeFunction51(source, chunkName));

  return Buffer.concat(parts);
}

function encodeFunction51(source, chunkName) {
  const bufs = [];

  // source name
  bufs.push(encodeLuaString51(chunkName));

  // line defined / last line defined (both 0 for top-level)
  bufs.push(int32LE(0), int32LE(0));

  // nups (0), numparams (0), is_vararg (1=VARARG_ISVARARG), maxstacksize (2)
  bufs.push(Buffer.from([0x00, 0x00, 0x01, 0x02]));

  // ── Instructions ─────────────────────────────────────────────────────────
  // LOADK  A=0 Bx=0   → R(0) = K(0)  (load the source string constant)
  // RETURN A=0 B=1    → return (no values)
  const instructions = [
    encodeABx(1 /* OP_LOADK */, 0, 0),
    encodeABC(31 /* OP_RETURN */, 0, 1, 0),
  ];
  bufs.push(int32LE(instructions.length));
  for (const instr of instructions) bufs.push(instr);

  // ── Constants ─────────────────────────────────────────────────────────────
  // K(0) = source string
  bufs.push(int32LE(1));              // nk = 1
  bufs.push(Buffer.from([0x04]));     // LUA_TSTRING
  bufs.push(encodeLuaString51(source));

  // ── Upvalues (none) ───────────────────────────────────────────────────────
  bufs.push(int32LE(0));

  // ── Prototypes (none) ─────────────────────────────────────────────────────
  bufs.push(int32LE(0));

  // ── Source lines (none) ───────────────────────────────────────────────────
  bufs.push(int32LE(0));

  // ── Locals (none) ────────────────────────────────────────────────────────
  bufs.push(int32LE(0));

  // ── Upvalue names (none) ─────────────────────────────────────────────────
  bufs.push(int32LE(0));

  return Buffer.concat(bufs);
}

// ─── Encoding helpers ─────────────────────────────────────────────────────────

function int32LE(n) {
  const b = Buffer.allocUnsafe(4);
  b.writeInt32LE(n, 0);
  return b;
}

/** Lua 5.1 string: 4-byte length (including null terminator) + bytes + \0 */
function encodeLuaString51(str) {
  if (str === null || str === undefined) return int32LE(0);
  const strBuf = Buffer.from(str, 'utf8');
  const len    = int32LE(strBuf.length + 1);
  return Buffer.concat([len, strBuf, Buffer.from([0x00])]);
}

/** Encode a 32-bit Lua instruction in ABC format (little-endian) */
function encodeABC(op, a, b, c) {
  // Lua 5.1 instruction layout (little-endian 32 bits):
  // [0..5]=OP  [6..13]=A  [14..22]=C  [23..31]=B
  const instr = (op & 0x3F) | ((a & 0xFF) << 6) | ((c & 0x1FF) << 14) | ((b & 0x1FF) << 23);
  return int32LE(instr);
}

/** Encode a 32-bit Lua instruction in ABx format */
function encodeABx(op, a, bx) {
  // [0..5]=OP  [6..13]=A  [14..31]=Bx
  const instr = (op & 0x3F) | ((a & 0xFF) << 6) | ((bx & 0x3FFFF) << 14);
  return int32LE(instr);
}

module.exports = { rebuildLuac };
