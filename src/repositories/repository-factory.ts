/**
 * Repository Factory
 *
 * Creates and caches a ScoreRepository backed by Cloud Firestore.
 */

import type { Firestore } from 'firebase/firestore';
import { ScoreRepository } from '@/repositories/score-repository';
import { UserRepository } from '@/repositories/user-repository';

interface FactoryConfig {
  db: Firestore;
}

export class RepositoryFactory {
  private config: FactoryConfig;
  private readonly instances = new Map<string, unknown>();

  constructor(config: FactoryConfig) {
    this.config = config;
  }

  getScoreRepository(): ScoreRepository {
    if (this.instances.has('score')) return this.instances.get('score') as ScoreRepository;

    if (!this.config.db) {
      throw new Error(
        'RepositoryFactory: db is required. Pass { db } from firebase-config.ts.',
      );
    }

    const repo = new ScoreRepository(this.config.db);
    this.instances.set('score', repo);
    return repo;
  }

  getUserRepository(): UserRepository {
    if (this.instances.has('user')) return this.instances.get('user') as UserRepository;

    if (!this.config.db) {
      throw new Error(
        'RepositoryFactory: db is required. Pass { db } from firebase-config.ts.',
      );
    }

    const repo = new UserRepository(this.config.db);
    this.instances.set('user', repo);
    return repo;
  }

  reconfigure(config: Partial<FactoryConfig>): void {
    this.config = { ...this.config, ...config };
    this.instances.clear();
  }

  getConfig(): FactoryConfig {
    return { ...this.config };
  }
}

export function createRepositoryFactory(config: FactoryConfig): RepositoryFactory {
  return new RepositoryFactory(config);
}
