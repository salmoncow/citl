/**
 * app-services.ts — Composition root (spec 003, DD-1)
 *
 * The ONE place the live Firestore-backed object graph is assembled.
 * Components import getServices() and share a single ScoreService (and
 * therefore a single 1-hour cache), so a publishWeek invalidation in the
 * admin panel reaches the cache the Home page reads.
 *
 * Lazy + memoized: nothing is constructed at module-evaluation time, so
 * importing this file has no side effects and no init-order coupling with
 * firebase-config. First getServices() call builds the graph; every later
 * call returns the same frozen instance.
 *
 * Tests construct ScoreService directly with stub repositories and must
 * NEVER import this file (it would pull in the real firebase-config).
 */

import { db } from '@/firebase-config';
import { createRepositoryFactory, type RepositoryFactory } from '@/repositories/repository-factory';
import { ScoreService } from '@/services/score-service';
import { SeasonAwardsService } from '@/services/season-awards-service';
import { AccountService } from '@/services/account-service';
import { callable } from '@/infrastructure/functions';
import type {
  DeleteAccountRequest,
  DeleteAccountResponse,
  SetAccountStatusRequest,
  SetAccountStatusResponse,
} from '@/types/account';

export interface AppServices {
  repositoryFactory: RepositoryFactory;
  scoreService: ScoreService;
  seasonAwardsService: SeasonAwardsService;
  accountService: AccountService;
}

let instance: AppServices | null = null;

export function getServices(): AppServices {
  if (!instance) {
    const repositoryFactory = createRepositoryFactory({ db });
    const repository = repositoryFactory.getScoreRepository();
    const scoreService = new ScoreService(repository);
    const seasonAwardsService = new SeasonAwardsService(repository, scoreService);
    // Callables are resolved on first use so building the graph never
    // initializes the Functions SDK.
    const accountService = new AccountService(repositoryFactory.getProfileRepository(), () => ({
      setAccountStatus: callable<SetAccountStatusRequest, SetAccountStatusResponse>('setAccountStatus'),
      deleteAccount: callable<DeleteAccountRequest, DeleteAccountResponse>('deleteAccount'),
    }));
    instance = Object.freeze({ repositoryFactory, scoreService, seasonAwardsService, accountService });
  }
  return instance;
}
