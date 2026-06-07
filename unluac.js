// commands/unluac.js
'use strict';

const { execFile }          = require('child_process');
const { promisify }         = require('util');
const execAsync             = promisify(execFile);
const fs                    = require('fs');
const path                  = require('path');
const os                    = require('os');
const { sendChunked, sendError, sendSuccess } = require('../utils/responder');
const logger                = require('../utils/logger');

/**
 * !unluac  –  Decompile a .luac binary back to Lua source.
 *
 * Strategy (tries in order):
 *   1. unluac.jar   (Java-based decompiler – best output)
 *   2. luadec binary
 *   3. Raw header analysis + constant extraction (JS fallback)
 */

module.exports = {
  name: 'unluac',
  description: 'Decompile Lua bytecode (.luac) → readable Lua source.',
  usage: '!unluac  (attach a .luac file)',

  async execute(ctx) {
    const { message, script } = ctx;

    // For binary files, the raw bytes arrive as a string from attachmentProcessor;
    // we need the original attachment buffer.
    const attachment = message.attachments.first();
    if (!attachment) {
      return sendError(message, 'Attach a `.luac` file to decompile.');
    }
    if (!attachment.name.endsWith('.luac')) {
      return sendError(message, 'Only `.luac` (compiled Lua bytecode) files are accepted.');
    }

    const thinking = await message.reply('⏳ Decompiling bytecode…');

    try {
      // Re-download as binary
      const axios    = require('axios');
      const response = await axios.get(attachment.url, { responseType: 'arraybuffer', timeout: 10_000 });
      const rawBuf   = Buffer.from(response.data);

      // Validate Lua 5.1 header: \x1BLua\x51
      if (rawBuf[0] !== 0x1B || rawBuf.slice(1, 4).toString() !== 'Lua') {
        await thinking.delete().catch(() => {});
        return sendError(message, 'File does not appear to be a valid Lua bytecode file.');
      }

      const luaVer = rawBuf[4].toString(16);
      logger.debug(`[unluac] Lua version byte: 0x${luaVer}`);

      let source = null;

      // ── Strategy 1: unluac.jar ──────────────────────────────────────────
      source = await tryUnluacJar(rawBuf);

      // ── Strategy 2: luadec binary ──────────────────────────────────────
      if (!source) source = await tryLuadec(rawBuf);

      // ── Strategy 3: JS constant extractor ─────────────────────────────
      if (!source) source = extractConstants(rawBuf);

      await thinking.delete().catch(() => {});

      if (!source) {
        return sendError(message, 'All decompilation strategies failed. Try a different tool.');
      }

      await message.reply(`✅ Decompiled (Lua 0x${luaVer})`);
      await sendChunked(message, source, { lang: 'lua', filename: 'decompiled.lua' });

    } catch (err) {
      await thinking.delete().catch(() => {});
      logger.error('[unluac]', err);
      await sendError(message, `Decompilation error: \`${err.message}\``);
    }
  },
};

// ─── Strategy implementations ─────────────────────────────────────────────────

async function tryUnluacJar(buf) {
  const JAR = process.env.UNLUAC_JAR || path.join(__dirname, '..', 'bin', 'unluac.jar');
  if (!fs.existsSync(JAR)) return null;

  const tmp = path.join(os.tmpdir(), `unluac_in_${Date.now()}.luac`);
  try {
    fs.writeFileSync(tmp, buf);
    const { stdout } = await execAsync('java', ['-jar', JAR, tmp], { timeout: 15_000 });
    return stdout || null;
  } catch (e) {
    logger.debug('[unluac] unluac.jar failed:', e.message);
    return null;
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

async function tryLuadec(buf) {
  const tmp = path.join(os.tmpdir(), `luadec_in_${Date.now()}.luac`);
  try {
    fs.writeFileSync(tmp, buf);
    const { stdout } = await execAsync('luadec', [tmp], { timeout: 10_000 });
    return stdout || null;
  } catch {
    return null;
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

/**
 * Fallback: walk the bytecode and extract all string constants.
 * Not a real decompiler, but recovers embedded strings / source names.
 */
function extractConstants(buf) {
  const lines = ['-- [unluac fallback: constant extraction only]', ''];
  let i = 12; // skip header

  const readInt = () => { const v = buf.readInt32LE(i); i += 4; return v; };
  const readByte = () => buf[i++];

  function readString() {
    const len = readInt();
    if (len === 0) return null;
    const s = buf.slice(i, i + len - 1).toString('utf8');
    i += len;
    return s;
  }

  function readProto(depth = 0) {
    const indent = '  '.repeat(depth);
    try {
      const name = readString();
      if (name) lines.push(`${indent}-- chunk: ${name}`);
      readInt(); readInt();           // lineDefined, lastLineDefined
      readByte(); readByte(); readByte(); readByte(); // nups, params, vararg, maxstack

      // instructions
      const nCode = readInt();
      i += nCode * 4;

      // constants
      const nK = readInt();
      for (let k = 0; k < nK; k++) {
        const t = readByte();
        if (t === 4) {                // LUA_TSTRING
          const s = readString();
          if (s && s.length > 1) lines.push(`${indent}-- K[${k}] = ${JSON.stringify(s)}`);
        } else if (t === 3) {         // LUA_TNUMBER
          const n = buf.readDoubleBE(i); i += 8;
          lines.push(`${indent}-- K[${k}] = ${n}`);
        } else if (t === 1) {         // LUA_TBOOLEAN
          lines.push(`${indent}-- K[${k}] = ${readByte() !== 0}`);
        }
      }

      // nested protos
      const nProtos = readInt();
      for (let p = 0; p < nProtos; p++) readProto(depth + 1);

      // source lines
      const nLines = readInt(); i += nLines * 4;
      // locals
      const nLocals = readInt();
      for (let l = 0; l < nLocals; l++) { readString(); readInt(); readInt(); }
      // upvalue names
      const nUpvals = readInt();
      for (let u = 0; u < nUpvals; u++) readString();
    } catch {}
  }

  readProto();
  return lines.join('\n');
}
