'use strict';

const { processAttachment } = require('./attachmentProcessor');
const { RateLimiter }       = require('../security/rateLimiter');
const { checkBan }          = require('../security/banSystem');
const logger                = require('../utils/logger');
const { sendError, sendChunked } = require('../utils/responder');

const PREFIX      = process.env.BOT_PREFIX || '!';
const rateLimiter = new RateLimiter();

/**
 * Attaches the main message listener to the client.
 * @param {import('discord.js').Client} client
 */
function attachMessageListener(client) {
  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot)              return;
      if (!message.content.startsWith(PREFIX)) return;

      // ── Anti-abuse ──────────────────────────────────────────
      const userId = message.author.id;

      if (await checkBan(userId)) {
        return message.reply('🚫 You are banned from using this bot.');
      }

      if (!rateLimiter.check(userId)) {
        return message.reply(
          `⏱️ Rate limit exceeded. Please wait ${rateLimiter.ttl(userId)}s.`
        );
      }

      // ── Parse command + args ─────────────────────────────────
      const raw      = message.content.slice(PREFIX.length).trim();
      const [cmd, ...argParts] = raw.split(/\s+/);
      const commandName = cmd.toLowerCase();

      const handler = client.commandMap.get(commandName);
      if (!handler) return; // silently ignore unknown commands

      // ── Extract script content ───────────────────────────────
      let scriptContent = argParts.join(' ').trim();

      // Strip code blocks  ```lua … ``` or ``` … ```
      scriptContent = scriptContent
        .replace(/^```(?:lua)?\n?([\s\S]*?)\n?```$/m, '$1')
        .trim();

      // Attachment takes priority over inline text
      if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        scriptContent = await processAttachment(attachment);
        if (scriptContent === null) {
          return sendError(message, 'Could not read attachment. Only `.lua` and `.txt` files are accepted.');
        }
      }

      // ── Build context object ─────────────────────────────────
      const ctx = {
        message,
        author: message.author,
        guild:  message.guild,
        args:   argParts,
        script: scriptContent,
        client,
      };

      logger.info(`CMD [${commandName}] by ${message.author.tag} in ${message.guild?.name || 'DM'}`);

      // ── Execute ──────────────────────────────────────────────
      await handler.execute(ctx);

    } catch (err) {
      logger.error('messageCreate handler error:', err);
      sendError(message, `Internal error: \`${err.message}\``).catch(() => {});
    }
  });
}

module.exports = { attachMessageListener };
