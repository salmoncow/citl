/**
 * Repository Factory
 *
 * Creates and caches the Firestore-backed repositories (score, user, profile,
 * league, dependent).
 */

import type { Firestore } from 'firebase/firestore';
import { ScoreRepository } from '@/repositories/score-repository';
import { UserRepository } from '@/repositories/user-repository';
import { ProfileRepository } from '@/repositories/profile-repository';
import { LeagueRepository } from '@/repositories/league-repository';
import { DependentRepository } from '@/repositories/dependent-repository';

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

  getProfileRepository(): ProfileRepository {
    if (this.instances.has('profile')) return this.instances.get('profile') as ProfileRepository;

    if (!this.config.db) {
      throw new Error(
        'RepositoryFactory: db is required. Pass { db } from firebase-config.ts.',
      );
    }

    const repo = new ProfileRepository(this.config.db);
    this.instances.set('profile', repo);
    return repo;
  }

  getLeagueRepository(): LeagueRepository {
    return this._memo('league', () => new LeagueRepository(this._requireDb()));
  }

  getDependentRepository(): DependentRepository {
    return this._memo('dependent', () => new DependentRepository(this._requireDb()));
  }

  private _memo<T>(key: string, make: () => T): T {
    if (!this.instances.has(key)) this.instances.set(key, make());
    return this.instances.get(key) as T;
  }

  private _requireDb(): Firestore {
    if (!this.config.db) {
      throw new Error(
        'RepositoryFactory: db is required. Pass { db } from firebase-config.ts.',
      );
    }
    return this.config.db;
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
