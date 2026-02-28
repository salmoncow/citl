/**
 * Repository Factory
 *
 * Creates and caches repository instances based on the configured backend.
 * Enables swapping storage backends (Firestore ↔ localStorage stub) without
 * changing the service layer.
 *
 * Current backends:
 *   'firestore'    — Cloud Firestore (requires firebase-config.js)
 *   'stub'         — In-memory no-op (for testing / offline dev without .env)
 *   'localStorage' — Browser localStorage (offline dev / admin entry before Firestore is provisioned)
 *
 * Usage:
 *   import { createRepositoryFactory } from '@/repositories/repository-factory.js';
 *   import { db } from '@/firebase-config.js';
 *
 *   const factory = createRepositoryFactory({ db });
 *   const scoreRepo = factory.getScoreRepository();
 */

import { ScoreRepository } from '@/repositories/score-repository.js';
import { LocalStorageScoreRepository } from '@/repositories/localstorage-score-repository.js';

/**
 * @typedef {'firestore' | 'stub' | 'localStorage'} StorageBackend
 */

/**
 * @typedef {Object} FactoryConfig
 * @property {import('firebase/firestore').Firestore} [db] - Firestore instance (required for 'firestore' backend)
 * @property {StorageBackend} [backend] - Which backend to use (default: 'firestore')
 */

/** @type {FactoryConfig} */
const DEFAULT_CONFIG = Object.freeze({
  backend: 'firestore',
});

// ---------------------------------------------------------------------------
// Stub repository (in-memory no-op for offline dev)
// ---------------------------------------------------------------------------

/** @returns {import('./score-repository.js').Result} */
function stubSuccess() {
  return { success: true, data: null };
}

/**
 * A no-op ScoreRepository for offline development without Firestore credentials.
 * Every method resolves immediately with success(null).
 */
class StubScoreRepository {
  async getSeason() { return stubSuccess(); }
  async getAllSeasons() { return { success: true, data: [] }; }
  async getTeams() { return { success: true, data: [] }; }
  async getTeam() { return stubSuccess(); }
  async getWeekResult() { return stubSuccess(); }
  async getAllWeekResults() { return { success: true, data: [] }; }
  async getLatestWeekResult() { return stubSuccess(); }
  async saveWeekResult() { return stubSuccess(); }
  async updateSeason() { return stubSuccess(); }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Repository factory — creates and caches repository instances.
 */
export class RepositoryFactory {
  /**
   * @param {FactoryConfig} [config]
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    /** @type {Map<string, object>} */
    this.instances = new Map();
  }

  /**
   * Get a ScoreRepository instance (singleton per backend).
   * @returns {ScoreRepository | StubScoreRepository}
   */
  getScoreRepository() {
    const key = `score:${this.config.backend}`;
    if (this.instances.has(key)) return this.instances.get(key);

    let repo;

    switch (this.config.backend) {
      case 'firestore':
        if (!this.config.db) {
          throw new Error(
            'RepositoryFactory: db is required when backend is "firestore". ' +
            'Pass { db } from firebase-config.js.',
          );
        }
        repo = new ScoreRepository(this.config.db);
        break;

      case 'stub':
        repo = new StubScoreRepository();
        break;

      case 'localStorage':
        repo = new LocalStorageScoreRepository();
        break;

      default:
        throw new Error(`RepositoryFactory: unknown backend "${this.config.backend}"`);
    }

    this.instances.set(key, repo);
    return repo;
  }

  /**
   * Swap backend and clear cached instances (e.g. after Firebase credentials load).
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
 * @param {FactoryConfig} [config]
 * @returns {RepositoryFactory}
 */
export function createRepositoryFactory(config) {
  return new RepositoryFactory(config);
}
