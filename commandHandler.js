'use strict';

const path = require('path');
const fs   = require('fs');
const logger = require('../utils/logger');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands');

/**
 * Loads every .js file in /commands and maps name → handler.
 * @param {import('discord.js').Client} client
 */
function registerCommands(client) {
  const commandMap = new Map();

  const files = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const cmd = require(path.join(COMMANDS_DIR, file));
    if (!cmd.name || typeof cmd.execute !== 'function') {
      logger.warn(`Skipping ${file}: missing name or execute()`);
      continue;
    }

    const names = Array.isArray(cmd.name) ? cmd.name : [cmd.name];
    for (const n of names) {
      commandMap.set(n.toLowerCase(), cmd);
      logger.debug(`Registered command: ${n}`);
    }
  }

  client.commandMap = commandMap;
  logger.info(`Loaded ${commandMap.size} command alias(es) from ${files.length} file(s)`);
}

module.exports = { registerCommands };
