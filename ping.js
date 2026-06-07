// commands/ping.js
'use strict';
const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'ping',
  description: 'Check bot latency.',
  usage: '!ping',
  async execute(ctx) {
    const { message, client } = ctx;
    const sent = await message.reply('🏓 Pinging…');
    const roundtrip = sent.createdTimestamp - message.createdTimestamp;
    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🏓 Pong!')
      .addFields(
        { name: 'Roundtrip', value: `${roundtrip}ms`,          inline: true },
        { name: 'WS Latency', value: `${client.ws.ping}ms`,    inline: true },
      )
      .setTimestamp();
    await sent.edit({ content: '', embeds: [embed] });
  },
};
