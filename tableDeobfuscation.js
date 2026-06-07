'use strict';

function tryDeobfuscate(code) {
  // Pattern: local _a={...}; then _a[index] access pattern
  if (!code.includes('local') || !code.includes('[')) {
    return { success: false };
  }

  let output = code;

  // Extract table assignments
  const tablePattern = /local\s+(_\d+|_[a-zA-Z_]\w*)\s*=\s*\{([^}]+)\};/g;
  const tables = {};

  let match;
  while ((match = tablePattern.exec(code)) !== null) {
    const varName = match[1];
    const values = match[2].split(',').map(v => v.trim()).filter(Boolean);
    tables[varName] = values;
  }

  // Replace table accesses with direct values
  for (const [varName, values] of Object.entries(tables)) {
    const accessPattern = new RegExp(varName + '\[(\d+)\]', 'g');
    output = output.replace(accessPattern, (m, idx) => {
      const index = parseInt(idx);
      return values[index] !== undefined ? values[index] : m;
    });
  }

  if (output !== code) {
    return {
      success: true,
      output,
      method: 'Table Deobfuscation'
    };
  }

  return { success: false };
}

module.exports = { tryDeobfuscate };