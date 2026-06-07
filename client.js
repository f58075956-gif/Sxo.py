'use strict';

const { Client, GatewayIntentBits, Partials } = require('discord.js');

/**
 * Creates and returns a configured Discord client.
 */
function createClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
    // Shard-ready for future scaling
    shards: 'auto',
  });
}

module.exports = { createClient };
