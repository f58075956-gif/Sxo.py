'use strict';

require('dotenv').config();

const { createClient } = require('./discord/client');
const { registerCommands } = require('./discord/commandHandler');
const { attachMessageListener } = require('./discord/messageListener');
const logger = require('./utils/logger');
const { validateEnv } = require('./utils/envValidator');

// ─── Startup ─────────────────────────────────────────────────────────────────

(async () => {
  try {
    validateEnv();

    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('   Lua Dumper Bot  v2.0.0  –  starting up…');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const client = createClient();

    registerCommands(client);
    attachMessageListener(client);

    client.once('ready', () => {
      logger.info(`Logged in as ${client.user.tag}`);
      logger.info(`Serving ${client.guilds.cache.size} guild(s)`);
      client.user.setActivity('!help | Lua Dumper', { type: 'WATCHING' });
    });

    await client.login(process.env.DISCORD_TOKEN);
  } catch (err) {
    logger.error('Fatal startup error:', err);
    process.exit(1);
  }
})();

// ─── Graceful shutdown ────────────────────────────────────────────────────────

process.on('SIGINT',  () => { logger.info('SIGINT received – shutting down'); process.exit(0); });
process.on('SIGTERM', () => { logger.info('SIGTERM received – shutting down'); process.exit(0); });

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  process.exit(1);
});
