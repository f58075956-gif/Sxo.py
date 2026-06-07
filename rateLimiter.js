// security/rateLimiter.js
'use strict';

const LIMIT  = parseInt(process.env.RATE_LIMIT_COMMANDS) || 5;
const WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 10_000;

/**
 * In-memory sliding-window rate limiter per user ID.
 */
class RateLimiter {
  constructor() {
    /** @type {Map<string, number[]>} userId → array of timestamps */
    this._windows = new Map();
  }

  /**
   * Returns true if the user is within their limit.
   * @param {string} userId
   */
  check(userId) {
    const now    = Date.now();
    const stamps = (this._windows.get(userId) || [])
      .filter(t => now - t < WINDOW);

    if (stamps.length >= LIMIT) {
      this._windows.set(userId, stamps);
      return false;
    }

    stamps.push(now);
    this._windows.set(userId, stamps);
    return true;
  }

  /**
   * Seconds until the oldest request in the window expires.
   * @param {string} userId
   */
  ttl(userId) {
    const now    = Date.now();
    const stamps = this._windows.get(userId) || [];
    if (!stamps.length) return 0;
    const oldest = stamps[0];
    return Math.ceil((WINDOW - (now - oldest)) / 1000);
  }

  /** Clear a user's window (e.g. after an admin unban). */
  reset(userId) {
    this._windows.delete(userId);
  }
}

module.exports = { RateLimiter };
