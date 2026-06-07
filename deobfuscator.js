'use strict';

const logger = require('../utils/logger');

// ── Handler registry ─────────────────────────────────────────────────────────
// Lazy-loaded on first use to keep startup fast.
const HANDLER_MAP = {
  moonsec        : () => require('../handlers/moonsec'),
  luraph         : () => require('../handlers/luraph'),
  wearedevs      : () => require('../handlers/wearedevs'),
  luaobfuscator  : () => require('../handlers/luaobfuscator'),
  iprotect       : () => require('../handlers/iprotect'),
  nigalose       : () => require('../handlers/nigalose'),
  ryzens         : () => require('../handlers/ryzens'),
  xhider         : () => require('../handlers/xhider'),
  anonymous_net  : () => require('../handlers/anonymous_net'),
  '25ms'         : () => require('../handlers/twentyfivems'),
  moonix         : () => require('../handlers/moonix'),
  virtualbox     : () => require('../handlers/virtualbox'),
  generic        : () => require('../handlers/generic'),
};

/**
 * Runs the appropriate deobfuscation handler for a detected obfuscator.
 *
 * @param {string} script
 * @param {{ name: string, handler: string, confidence: number }} detection
 * @param {{ verbose?: boolean }} opts
 * @returns {Promise<{ output: string, changed: boolean, info: string }>}
 */
async function runDeobfuscation(script, detection, opts = {}) {
  const handlerKey = detection.handler;

  // Resolve loader; fall back to generic
  const loader = HANDLER_MAP[handlerKey] ?? HANDLER_MAP.generic;
  let handler;

  try {
    handler = loader();
  } catch (e) {
    logger.warn(`Handler "${handlerKey}" not loadable – using generic: ${e.message}`);
    handler = require('../handlers/generic');
  }

  try {
    const result = await handler.deobfuscate(script, opts);
    return result;
  } catch (err) {
    logger.error(`Handler "${handlerKey}" threw:`, err);
    // Return unchanged so the pipeline can still finish
    return { output: script, changed: false, info: `handler error: ${err.message}` };
  }
}

module.exports = { runDeobfuscation };
