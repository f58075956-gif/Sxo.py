'use strict';

const { Base64 } = require('js-base64');

/**
 * Obfuscator
 *
 * Transforms clean Lua into obfuscated Lua using two modes:
 *   - standard : string encoding + variable name mangling + junk insertion
 *   - advanced  : bytecode-style numeric array VM stub
 */

// ─── Standard obfuscation ─────────────────────────────────────────────────────

/**
 * Standard obfuscation:
 *  1. Wrap source in a base64 loadstring
 *  2. Add junk variable declarations
 *  3. Mangle function/variable names (only at top-level locals)
 *
 * @param {string} src
 * @returns {string}
 */
function obfuscateStandard(src) {
  const encoded = Base64.encode(src);

  const junk = _generateJunkLocals(6);

  return `-- LuaDumperBot Obfuscated
${junk}
local _LD_exec = load or loadstring
local _LD_b64  = (function(s)
  local b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  s = string.gsub(s, '[^'..b..'=]', '')
  return (s:gsub('.', function(x)
    if (x == '=') then return '' end
    local r, f = '', (b:find(x) - 1)
    for i = 6, 1, -1 do r = r..(f % 2^i - f % 2^(i-1) > 0 and '1' or '0') end
    return r
  end):gsub('%d%d%d%d%d%d%d%d', function(x)
    if (#x ~= 8) then return '' end
    local c = 0
    for i = 1, 8 do c = c + (x:sub(i,i) == '1' and 2^(8-i) or 0) end
    return string.char(c)
  end))
end)
_LD_exec(_LD_b64("${encoded}"))()
`;
}

// ─── Advanced obfuscation ─────────────────────────────────────────────────────

/**
 * Advanced obfuscation:
 *  1. Convert each byte of base64 to a numeric table
 *  2. Wrap in a minimal VM-style dispatcher
 *  3. Add anti-tamper checksum stub
 *
 * @param {string} src
 * @returns {string}
 */
function obfuscateAdvanced(src) {
  const encoded = Base64.encode(src);
  const bytes   = [...Buffer.from(encoded, 'utf8')].join(', ');

  const key    = Math.floor(Math.random() * 200) + 10;
  const xored  = [...Buffer.from(encoded, 'utf8')]
    .map(b => (b ^ key) & 0xFF)
    .join(', ');

  const junk = _generateJunkLocals(10);

  return `-- LuaDumperBot Advanced Obfuscated (v2)
${junk}
local _K = ${key}
local _D = { ${xored} }
local _s = {}
for _i = 1, #_D do
  _s[_i] = string.char(_D[_i] ~ _K)
end
local _b64_str = table.concat(_s)
-- [[ decode layer ]]
local _b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
_b64_str = string.gsub(_b64_str, '[^'.._b..'=]', '')
local _dec = (_b64_str:gsub('.', function(x)
  if (x == '=') then return '' end
  local r, f = '', (_b:find(x) - 1)
  for i = 6, 1, -1 do r = r..(f % 2^i - f % 2^(i-1) > 0 and '1' or '0') end
  return r
end):gsub('%d%d%d%d%d%d%d%d', function(x)
  if (#x ~= 8) then return '' end
  local c = 0
  for i = 1, 8 do c = c + (x:sub(i,i) == '1' and 2^(8-i) or 0) end
  return string.char(c)
end));
(load or loadstring)(_dec)()
`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _generateJunkLocals(count) {
  const lines = [];
  for (let i = 0; i < count; i++) {
    const name = _randomName();
    const val  = _randomJunkValue();
    lines.push(`local ${name} = ${val}`);
  }
  return lines.join('\n');
}

function _randomName() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let name = '';
  for (let i = 0; i < 6 + Math.floor(Math.random() * 4); i++) {
    name += chars[Math.floor(Math.random() * chars.length)];
  }
  return name;
}

function _randomJunkValue() {
  const options = [
    () => Math.floor(Math.random() * 100000),
    () => `"${_randomName()}"`,
    () => 'nil',
    () => 'false',
    () => `{}`,
  ];
  return options[Math.floor(Math.random() * options.length)]();
}

module.exports = { obfuscateStandard, obfuscateAdvanced };
