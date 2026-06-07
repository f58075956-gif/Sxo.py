// commands/loadstring.js
'use strict';

const { inlineLoadstrings } = require('../core/parser');
const { sendChunked, sendError } = require('../utils/responder');

module.exports = {
  name: 'loadstring',
  description: 'Resolve and inline all loadstring() / load() layers in a script.',
  usage: '!loadstring <code>',
  async execute(ctx) {
    const { message, script } = ctx;
    if (!script) return sendError(message, 'Provide a Lua script.');

    let current  = script;
    let total    = 0;
    let passes   = 0;
    const MAX    = 10;

    while (passes < MAX) {
      const { result, resolved } = inlineLoadstrings(current);
      if (resolved === 0) break;
      current = result;
      total  += resolved;
      passes++;
    }

    if (total === 0) return sendError(message, 'No resolvable `loadstring` / `load` layers found.');

    await message.reply(`✅ Resolved **${total}** loadstring layer(s) across **${passes}** pass(es).`);
    await sendChunked(message, current, { lang: 'lua', filename: 'loadstring_resolved.lua' });
  },
};
