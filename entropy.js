// utils/entropy.js
'use strict';
/**
 * Shannon entropy of a string (bits per character).
 * High entropy (> 5.0) indicates obfuscation / encoding.
 */
function entropy(str) {
  const freq = {};
  for (const c of str) freq[c] = (freq[c] || 0) + 1;
  const len = str.length;
  return -Object.values(freq).reduce((sum, f) => {
    const p = f / len;
    return sum + p * Math.log2(p);
  }, 0);
}
module.exports = { entropy };
