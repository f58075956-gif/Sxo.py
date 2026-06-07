// security/sandbox.js
'use strict';

/**
 * Sandboxed Lua execution stub.
 *
 * In production, replace the inner execution with one of:
 *   - A child_process.spawn calling a restricted `lua` binary (ulimit, seccomp)
 *   - A WASM Lua interpreter (e.g. fengari-node)
 *   - A Docker container via dockerode
 *
 * This module provides the interface; the stub returns a safe trace.
 */

const { VM, VMScript } = require('vm2');
const logger = require('../utils/logger');

const SANDBOX_TIMEOUT = parseInt(process.env.SANDBOX_TIMEOUT_MS) || 5000;

/**
 * Attempt to "execute" a Lua-like script in an isolated JS VM for tracing.
 * NOTE: This does NOT actually run Lua – it runs the JS equivalent of
 * structural analysis so we can extract string constants and call chains
 * without executing arbitrary code.
 *
 * @param {string} script
 * @returns {{ output: string, error: string|null, trace: string[] }}
 */
function sandboxTrace(script) {
  if (process.env.ENABLE_SANDBOX !== 'true') {
    return { output: '', error: 'Sandbox disabled', trace: [] };
  }

  const trace   = [];
  const globals = buildMockGlobals(trace);

  try {
    const vm = new VM({
      timeout  : SANDBOX_TIMEOUT,
      sandbox  : globals,
      eval     : false,
      wasm     : false,
    });

    // Transpile minimal Lua → JS for surface-level tracing
    const jsCode = luaToJsStub(script);
    const result = vm.run(new VMScript(jsCode));

    return { output: String(result ?? ''), error: null, trace };
  } catch (err) {
    logger.debug('[sandbox] VM error:', err.message);
    return { output: '', error: err.message, trace };
  }
}

function buildMockGlobals(trace) {
  return {
    print   : (...a) => trace.push('[print] ' + a.join('\t')),
    require : (m)    => { trace.push(`[require] ${m}`); return {}; },
    load    : (s)    => { trace.push(`[load] ${String(s).slice(0, 60)}…`); return () => null; },
    loadstring:(s)   => { trace.push(`[loadstring] ${String(s).slice(0, 60)}…`); return () => null; },
    pcall   : (f,...a) => { try { return [true, f(...a)]; } catch(e) { return [false, e.message]; } },
    table   : { concat: (t, sep) => (t || []).join(sep || '') },
    string  : {
      char  : (...ns) => ns.map(n => String.fromCharCode(n)).join(''),
      byte  : (s, i)  => (s || '').charCodeAt((i || 1) - 1),
      gsub  : (s, p, r) => [s.replace(new RegExp(p, 'g'), r), 0],
      rep   : (s, n)  => s.repeat(n),
      sub   : (s, i, j) => s.slice(i - 1, j),
      len   : (s)     => s.length,
      format: (fmt, ...a) => fmt, // stub
    },
    math    : { floor: Math.floor, ceil: Math.ceil, abs: Math.abs },
    bit     : {
      bxor  : (a, b) => a ^ b,
      band  : (a, b) => a & b,
      bor   : (a, b) => a | b,
      rshift: (a, b) => a >> b,
      lshift: (a, b) => a << b,
    },
  };
}

/**
 * Extremely minimal Lua→JS surface transpiler for tracing only.
 * Only translates top-level print / load / require calls.
 */
function luaToJsStub(lua) {
  return lua
    .replace(/--[^\n]*/g, '//$&')          // comments
    .replace(/\blocal\b/g, 'let')
    .replace(/\bthen\b/g, '{')
    .replace(/\bdo\b/g, '{')
    .replace(/\bend\b/g, '}')
    .replace(/\brepeat\b/g, 'do {')
    .replace(/\buntil\b/g, '} while (!(')
    .replace(/~=/g, '!==')
    .replace(/\.\./g, '+');
}

module.exports = { sandboxTrace };
