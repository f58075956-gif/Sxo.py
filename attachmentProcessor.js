'use strict';

const axios  = require('axios');
const logger = require('../utils/logger');

const MAX_SIZE_BYTES = (parseInt(process.env.MAX_SCRIPT_SIZE_KB) || 512) * 1024;
const ALLOWED_EXTS   = ['.lua', '.txt', '.luac'];

/**
 * Downloads a Discord attachment and returns its text content,
 * or null if the file type / size is disallowed.
 *
 * @param {import('discord.js').Attachment} attachment
 * @returns {Promise<string|null>}
 */
async function processAttachment(attachment) {
  const url  = attachment.url;
  const name = (attachment.name || '').toLowerCase();

  // Extension check
  if (!ALLOWED_EXTS.some(ext => name.endsWith(ext))) {
    logger.warn(`Rejected attachment: ${name} (bad extension)`);
    return null;
  }

  // Size check (Discord gives us the size upfront)
  if (attachment.size > MAX_SIZE_BYTES) {
    logger.warn(`Rejected attachment: ${name} (${attachment.size} bytes > limit)`);
    return null;
  }

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      maxContentLength: MAX_SIZE_BYTES,
      timeout: 10_000,
    });

    const content = Buffer.from(response.data).toString('utf-8');
    logger.debug(`Attachment loaded: ${name} (${content.length} chars)`);
    return content;

  } catch (err) {
    logger.error(`Failed to download attachment ${name}:`, err.message);
    return null;
  }
}

module.exports = { processAttachment };
