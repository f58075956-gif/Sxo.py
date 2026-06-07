// handlers/nigalose.js  ────────────────────────────────────────────────────────
'use strict';
const { inlineLoadstrings } = require('../core/parser');
async function deobfuscate(script) {
  // Nigalose: iterates over a byte table with a running-sum decoder
  const tableRe = /\{\s*(\d{1,3}(?:\s*,\s*\d{1,3})+)\s*\}/;
  const m = tableRe.exec(script);
  if (m) {
    const bytes = m[1].split(',').map(s => parseInt(s.trim(), 10));
    let acc = 0;
    const out = bytes.map(b => { acc = (acc + b) & 0xFF; return acc ^ b; });
    const str = Buffer.from(out).toString('utf8');
    if (/\b(local|function|return)\b/.test(str))
      return { output: str, changed: true, info: 'Nigalose: running-sum XOR decoded' };
  }
  const { result, resolved } = inlineLoadstrings(script);
  return resolved > 0
    ? { output: result, changed: true, info: `Nigalose: inlined ${resolved} loadstring(s)` }
    : { output: script, changed: false, info: 'Nigalose: no transformation possible' };
}
module.exports = { deobfuscate };
