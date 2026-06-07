// security/payloadScanner.js
'use strict';

const logger = require('../utils/logger');

/**
 * Scans a Lua script for dangerous payloads before processing.
 *
 * Checks for:
 *  - Discord token patterns (prevents token-logger scripts)
 *  - Webhook exfiltration URLs
 *  - OS command execution (os.execute, io.popen)
 *  - HTTP exfiltration (http.request to external IPs)
 *  - Filesystem write access
 */

const DANGER_PATTERNS = [
  {
    id     : 'discord_token',
    label  : 'Discord token extraction',
    re     : /[\w-]{24}\.[\w-]{6}\.[\w-]{27,}/,
  },
  {
    id     : 'webhook_exfil',
    label  : 'Discord webhook exfiltration',
    re     : /discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+/i,
  },
  {
    id     : 'os_execute',
    label  : 'OS command execution',
    re     : /\bos\.execute\s*\(|io\.popen\s*\(/,
  },
  {
    id     : 'file_write',
    label  : 'Filesystem write',
    re     : /io\.open\s*\([^,]+,\s*["'][wa]["']/,
  },
  {
    id     : 'http_exfil',
    label  : 'HTTP data exfiltration',
    // Matches http(s)://<ip or external host> inside string literals
    re     : /https?:\/\/(?:\d{1,3}\.){3}\d{1,3}|https?:\/\/(?!localhost|127\.0\.0\.1)/,
  },
  {
    id     : 'load_remote',
    label  : 'Remote code load',
    re     : /loadstring\s*\(\s*game\b.*HttpGet|HttpGetAsync/i,
  },
];

/**
 * @param {string} script
 * @returns {{ safe: boolean, threats: Array<{ id: string, label: string }> }}
 */
function scanPayload(script) {
  const threats = [];

  for (const { id, label, re } of DANGER_PATTERNS) {
    if (re.test(script)) {
      threats.push({ id, label });
      logger.warn(`[payloadScanner] Detected: ${label}`);
    }
  }

  return { safe: threats.length === 0, threats };
}

/**
 * Strip the most dangerous patterns from a script before analysis.
 * Does NOT make the script "safe" – only removes obvious exfil hooks.
 *
 * @param {string} script
 * @returns {string}
 */
function stripMaliciousPatterns(script) {
  let out = script;
  // Blank out webhook URLs
  out = out.replace(
    /discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+/gi,
    '<WEBHOOK_REDACTED>'
  );
  // Blank out token patterns
  out = out.replace(
    /[\w-]{24}\.[\w-]{6}\.[\w-]{27,}/g,
    '<TOKEN_REDACTED>'
  );
  return out;
}

module.exports = { scanPayload, stripMaliciousPatterns };
