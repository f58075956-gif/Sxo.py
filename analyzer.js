'use strict';

const { detectObfuscator }  = require('./detector');
const { runDeobfuscation }  = require('./deobfuscator');
const { rebuildLuac }       = require('./luac_rebuilder');
const { beautify }          = require('./parser');
const PerformanceTracker    = require('../utils/performanceTracker');
const logger                = require('../utils/logger');

/**
 * AnalysisResult shape:
 * {
 *   obfuscatorName: string,
 *   confidence: number,          // 0-1
 *   deobfuscated: string,
 *   luacBytes: Buffer | null,
 *   beautified: string,
 *   logs: string[],
 *   timing: object,
 *   layers: number,              // deobfuscation layers resolved
 * }
 */

/**
 * Full analysis pipeline.
 * Accepts raw or obfuscated Lua source (string) and returns a rich result.
 *
 * @param {string} script  – raw input (may be obfuscated)
 * @param {object} [opts]
 * @param {boolean} [opts.buildLuac=false]
 * @param {boolean} [opts.verbose=false]
 * @returns {Promise<AnalysisResult>}
 */
async function analyzeScript(script, opts = {}) {
  const perf = new PerformanceTracker();
  const logs = [];

  const log = (msg) => {
    logs.push(msg);
    logger.debug('[analyzer] ' + msg);
  };

  // ── 1. Detect ───────────────────────────────────────────────────────────────
  perf.start('detect');
  const detection = detectObfuscator(script);
  perf.end('detect');

  log(`Detection → ${detection.name} (confidence: ${(detection.confidence * 100).toFixed(1)}%)`);

  // ── 2. Deobfuscate (multi-layer) ────────────────────────────────────────────
  perf.start('deobfuscate');
  let current   = script;
  let layers    = 0;
  const MAX_LAYERS = 8;

  while (layers < MAX_LAYERS) {
    const layerDetect = detectObfuscator(current);
    if (layerDetect.name === 'Unknown' && layers > 0) break;
    if (layerDetect.confidence < 0.15 && layers > 0) break;

    log(`Layer ${layers + 1}: running handler for "${layerDetect.name}"`);

    const result = await runDeobfuscation(current, layerDetect, { verbose: opts.verbose });

    if (!result.changed) {
      log(`Layer ${layers + 1}: no transformation – stopping`);
      break;
    }

    current = result.output;
    layers++;
    log(`Layer ${layers}: resolved (${result.info})`);
  }

  perf.end('deobfuscate');

  // ── 3. Beautify ─────────────────────────────────────────────────────────────
  perf.start('beautify');
  const beautified = beautify(current);
  perf.end('beautify');

  // ── 4. Optional LUAC rebuild ─────────────────────────────────────────────────
  let luacBytes = null;
  if (opts.buildLuac) {
    perf.start('luac');
    try {
      luacBytes = await rebuildLuac(current, { source: detection.name });
      log(`LUAC rebuild: ${luacBytes.length} bytes`);
    } catch (e) {
      log(`LUAC rebuild failed: ${e.message}`);
    }
    perf.end('luac');
  }

  return {
    obfuscatorName : detection.name,
    confidence     : detection.confidence,
    deobfuscated   : current,
    luacBytes,
    beautified,
    logs,
    timing         : perf.summary(),
    layers,
  };
}

module.exports = { analyzeScript };
