// utils/envValidator.js
'use strict';

const REQUIRED = ['DISCORD_TOKEN'];

function validateEnv() {
  const missing = REQUIRED.filter(k => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}\nCopy .env.example → .env and fill in the values.`);
  }
}

module.exports = { validateEnv };
