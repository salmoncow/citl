/**
 * Repository Factory
 *
 * Creates and caches a ScoreRepository backed by Cloud Firestore.
 *
 * Usage:
 *   import { createRepositoryFactory } from '@/repositories/repository-factory.js';
 *   import { db } from '@/firebase-config.js';
 *
 *   const factory = createRepositoryFactory({ db });
 *   const scoreRepo = factory.getScoreRepository();
 */

import { ScoreRepository } from '@/repositories/score-repository.js';

/**
 * @typedef {Object} FactoryConfig
 * @property {import('firebase/firestore').Firestore} db - Firestore instance
 */

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Repository factory — creates and caches repository instances.
 */
export class RepositoryFactory {
  /**
   * @param {FactoryConfig} config
   */
  constructor(config) {
    this.config = config;
    /** @type {Map<string, object>} */
    this.instances = new Map();
  }

  /**
   * Get a ScoreRepository instance (singleton).
   * @returns {ScoreRepository}
   */
  getScoreRepository() {
    if (this.instances.has('score')) return this.instances.get('score');

    if (!this.config.db) {
      throw new Error(
        'RepositoryFactory: db is required. Pass { db } from firebase-config.js.',
      );
    }

    const repo = new ScoreRepository(this.config.db);
    this.instances.set('score', repo);
    return repo;
  }

  /**
   * Reconfigure and clear cached instances.
   * @param {Partial<FactoryConfig>} config
   */
  reconfigure(config) {
    this.config = { ...this.config, ...config };
    this.instances.clear();
  }

  /** @returns {FactoryConfig} */
  getConfig() {
    return { ...this.config };
  }
}

/**
 * Convenience factory function.
 * @param {FactoryConfig} config
 * @returns {RepositoryFactory}
 */
export function createRepositoryFactory(config) {
  return new RepositoryFactory(config);
}
