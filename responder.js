// utils/responder.js
'use strict';

const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const logger = require('./logger');

const MAX_MSG_LEN = 1900; // safe Discord limit

/**
 * Send a success embed with optional code block content.
 */
async function sendSuccess(message, { title, description, code, lang = 'lua', footer }) {
  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle(title || '✅ Done')
    .setTimestamp();

  if (footer)      embed.setFooter({ text: footer });
  if (description) embed.setDescription(description);

  if (code) {
    const block = `\`\`\`${lang}\n${code.slice(0, 1800)}\n\`\`\``;
    if (description) {
      embed.addFields({ name: '\u200b', value: block });
    } else {
      embed.setDescription(block);
    }
  }

  return message.reply({ embeds: [embed] });
}

/**
 * Send an error embed.
 */
async function sendError(message, text) {
  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('❌ Error')
    .setDescription(text)
    .setTimestamp();
  return message.reply({ embeds: [embed] }).catch(() => {});
}

/**
 * Send content that may exceed Discord's 2000-char limit.
 * Splits across multiple messages or sends as file attachment.
 */
async function sendChunked(message, content, { lang = 'lua', filename = 'output.lua' } = {}) {
  if (content.length <= MAX_MSG_LEN) {
    return message.reply(`\`\`\`${lang}\n${content}\n\`\`\``);
  }

  // Send as file attachment
  const buf  = Buffer.from(content, 'utf8');
  const file = new AttachmentBuilder(buf, { name: filename });
  return message.reply({
    content: `📎 Output too large – sent as file:`,
    files  : [file],
  });
}

/**
 * Send a raw file buffer as attachment.
 */
async function sendFile(message, buffer, filename, caption = '') {
  const file = new AttachmentBuilder(buffer, { name: filename });
  return message.reply({ content: caption || `📎 \`${filename}\``, files: [file] });
}

/**
 * Send an info / analysis embed with multiple fields.
 */
async function sendAnalysisEmbed(message, result) {
  const { obfuscatorName, confidence, layers, timing, logs, beautified } = result;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🔍 Lua Analysis Result')
    .addFields(
      { name: 'Detected Obfuscator', value: `\`${obfuscatorName}\``,                  inline: true },
      { name: 'Confidence',          value: `${(confidence * 100).toFixed(1)}%`,       inline: true },
      { name: 'Layers Resolved',     value: String(layers),                            inline: true },
      { name: 'Timing',              value: formatTiming(timing),                      inline: false },
    )
    .setTimestamp()
    .setFooter({ text: 'Lua Dumper Bot v2.0' });

  if (logs && logs.length > 0) {
    const logStr = logs.slice(-6).join('\n');
    embed.addFields({ name: '📋 Logs', value: `\`\`\`\n${logStr.slice(0, 900)}\n\`\`\`` });
  }

  await message.reply({ embeds: [embed] });

  // Send the code separately as chunked
  if (beautified) {
    await sendChunked(message, beautified, { lang: 'lua', filename: 'deobfuscated.lua' });
  }
}

function formatTiming(timing = {}) {
  return Object.entries(timing)
    .map(([k, v]) => `${k}: ${v}ms`)
    .join(' | ') || 'N/A';
}

module.exports = { sendSuccess, sendError, sendChunked, sendFile, sendAnalysisEmbed };
