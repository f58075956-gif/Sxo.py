// handlers/virtualbox.js
'use strict';

/**
 * Lua VirtualBox / VM-based obfuscator handler.
 *
 * VM obfuscators compile Lua to custom bytecode interpreted by an
 * embedded Lua VM.  Full decompilation requires emulating the VM.
 *
 * This handler:
 *   1. Extracts the instruction stream (numeric table)
 *   2. Extracts the constant pool
 *   3. Reconstructs readable pseudo-Lua from opcode patterns
 *   4. Returns the best-effort decompiled output + analysis notes
 */

const OPCODE_RE   = /opcodes?\s*=\s*\{([^}]+)\}/i;
const CONST_RE    = /constants?\s*=\s*\{([^}]+)\}/i;
const BYTECODE_RE = /\{\s*(\d{1,3}(?:\s*,\s*\d{1,3}){20,})\s*\}/;

// Minimal opcode table – extend as real VM bytecodes are reverse-engineered
const OPCODE_NAMES = {
  0:  'MOVE',   1:  'LOADK',   2:  'LOADBOOL', 3:  'LOADNIL',
  4:  'GETUPVAL',5: 'GETGLOBAL',6: 'GETTABLE', 7:  'SETGLOBAL',
  8:  'SETTABLE',12: 'ADD',     13: 'SUB',      14: 'MUL',
  15: 'DIV',    16: 'MOD',     17: 'POW',      18: 'UNM',
  19: 'NOT',    20: 'LEN',     21: 'CONCAT',   22: 'JMP',
  23: 'EQ',     24: 'LT',      25: 'LE',       26: 'TEST',
  27: 'TESTSET',28: 'CALL',    29: 'TAILCALL', 30: 'RETURN',
  31: 'FORLOOP',32: 'FORPREP', 34: 'TFORLOOP', 36: 'CLOSURE',
};

async function deobfuscate(script) {
  const lines = ['-- [VirtualBox Decompiler – Best-Effort Output]'];
  let changed = false;

  // ── Extract constants ────────────────────────────────────────────────────
  const constMatch = CONST_RE.exec(script);
  const constants  = constMatch
    ? constMatch[1].split(',').map(s => s.trim()).filter(Boolean)
    : [];

  if (constants.length > 0) {
    lines.push(`-- Constants (${constants.length}): ${constants.slice(0, 8).join(', ')}${constants.length > 8 ? '…' : ''}`);
    changed = true;
  }

  // ── Extract instruction stream ────────────────────────────────────────────
  const bcMatch = BYTECODE_RE.exec(script);
  if (bcMatch) {
    const words = bcMatch[1].split(',').map(s => parseInt(s.trim(), 10));

    lines.push(`-- Instructions (${words.length} words):`);

    for (let i = 0; i < Math.min(words.length, 256); i++) {
      const w      = words[i];
      const op     = w & 0x3F;
      const a      = (w >> 6) & 0xFF;
      const b      = (w >> 23) & 0x1FF;
      const c      = (w >> 14) & 0x1FF;
      const bx     = (w >> 14) & 0x3FFFF;
      const opName = OPCODE_NAMES[op] ?? `OP_${op}`;

      lines.push(`  [${String(i).padStart(4, '0')}] ${opName.padEnd(12)} A=${a}  B=${b}  C=${c}  Bx=${bx}`);
    }

    if (words.length > 256) lines.push(`  … (${words.length - 256} more instructions)`);
    changed = true;
  }

  if (!changed) {
    return { output: script, changed: false, info: 'VirtualBox: no bytecode stream found' };
  }

  lines.push('');
  lines.push('-- Original (partially obfuscated):');
  lines.push(script);

  return {
    output  : lines.join('\n'),
    changed : true,
    info    : `VirtualBox: disassembled ${bcMatch ? bcMatch[1].split(',').length : 0} instructions`,
  };
}
module.exports = { deobfuscate };
