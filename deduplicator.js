import { createHash } from 'node:crypto';

/**
 * Content deduplicator — prevents loading the same content twice
 * even when referenced via different paths.
 */
export class ContentDeduplicator {
  constructor() {
    this._hashes = new Set();
  }

  /**
   * Check if content has already been seen.
   * @param {string} content - The content to check
   * @returns {boolean} true if this is a duplicate
   */
  isDuplicate(content) {
    const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
    if (this._hashes.has(hash)) return true;
    this._hashes.add(hash);
    return false;
  }

  /**
   * Reset the deduplicator (e.g., between sessions).
   */
  reset() {
    this._hashes.clear();
  }

  get size() {
    return this._hashes.size;
  }
}
