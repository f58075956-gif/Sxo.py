// utils/queue.js
'use strict';

const { default: PQueue } = require('p-queue');

/**
 * Global async processing queue.
 * Limits concurrency so heavy deobfuscation jobs don't starve the event loop.
 */
const processingQueue = new PQueue({
  concurrency : parseInt(process.env.QUEUE_CONCURRENCY)  || 3,
  timeout     : parseInt(process.env.QUEUE_TIMEOUT_MS)   || 30_000,
  throwOnTimeout: true,
});

processingQueue.on('error', err => {
  require('./logger').error('[queue] Job error:', err);
});

module.exports = processingQueue;
