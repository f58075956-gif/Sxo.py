// utils/performanceTracker.js
'use strict';

class PerformanceTracker {
  constructor() { this._marks = {}; this._results = {}; }
  start(label) { this._marks[label] = Date.now(); }
  end(label) {
    if (!this._marks[label]) return;
    this._results[label] = Date.now() - this._marks[label];
    delete this._marks[label];
  }
  summary() { return { ...this._results }; }
  total() { return Object.values(this._results).reduce((a, b) => a + b, 0); }
}

module.exports = PerformanceTracker;
