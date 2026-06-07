// utils/logger.js
'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs   = require('fs');

const LOG_DIR   = process.env.LOG_DIR   || './logs';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const TO_FILE   = process.env.LOG_TO_FILE !== 'false';

if (TO_FILE && !fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const { combine, timestamp, printf, colorize, errors } = format;

const prettyFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}] ${stack || message}`;
});

const logger = createLogger({
  level      : LOG_LEVEL,
  format     : combine(errors({ stack: true }), timestamp({ format: 'HH:mm:ss' }), prettyFormat),
  transports : [
    new transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), prettyFormat),
    }),
    ...(TO_FILE ? [
      new transports.File({ filename: path.join(LOG_DIR, 'error.log'),  level: 'error' }),
      new transports.File({ filename: path.join(LOG_DIR, 'combined.log') }),
    ] : []),
  ],
});

module.exports = logger;
