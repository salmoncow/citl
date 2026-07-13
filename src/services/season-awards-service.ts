/**
 * SeasonAwardsService — season-end awards orchestration (spec 004 DD-3)
 *
 * Preview and finalize season awards. Reads go through the shared
 * ScoreService (cached, Result-typed) and consume PUBLISHED data only —
 * teams + published week docs via buildScorecardData, never the draft
 * `entries` audit docs — so trophies always agree with the public scorecards
 * page. Placements come from the stored season standings; the single write
 * goes through ScoreRepository.updateSeason.
 *
 * Import rule: types, scoring-engine, scorecard-builder, score-service,
 * repositories — never components/modules. Constructed only in the
 * composition root (app-services.ts); tests construct directly with stub
 * repositories and never import app-services.
 */

import { failure, success, type Result } from '@/repositories/score-repository';
import { computeSeasonAwards } from '@/services/scoring-engine';
import { toAwardShooterInputs } from '@/services/scorecard-builder';
import type { ScoreRepository } from '@/repositories/score-repository';
import type { ScoreService } from '@/services/score-service';
import type { SeasonAwards } from '@/types/season';

export class SeasonAwardsService {
  private readonly repository: ScoreRepository;
  private readonly scoreService: ScoreService;

  constructor(repository: ScoreRepository, scoreService: ScoreService) {
    if (!repository) throw new Error('SeasonAwardsService: repository is required');
    if (!scoreService) throw new Error('SeasonAwardsService: scoreService is required');
    this.repository = repository;
    this.scoreService = scoreService;
  }

  /**
   * Compute the awards for a season from published data, without writing.
   * Fails with NO_DATA when the season document is missing or has no
   * published weeks.
   */
  async previewAwards(year: number): Promise<Result<SeasonAwards>> {
    const seasonResult = await this.scoreService.getSeason(year);
    if (!seasonResult.success) return seasonResult;

    const season = seasonResult.data;
    if (!season || season.currentWeek < 1) {
      return failure(`No published data for season ${year}`, 'NO_DATA');
    }

    const viewResult = await this.scoreService.buildScorecardData(year);
    if (!viewResult.success) return viewResult;

    const inputs = toAwardShooterInputs(viewResult.data.teams);
    return success(computeSeasonAwards(inputs, season.standings ?? []));
  }

  /**
   * previewAwards, then write { awards, status: 'complete' } to the season
   * document and clear the shared cache. Idempotent by design: every run
   * recomputes from current published data and overwrites — re-running after
   * a week correction is the documented recovery path (spec 004 DD-3).
   */
  async finalizeSeason(year: number): Promise<Result<SeasonAwards>> {
    const preview = await this.previewAwards(year);
    if (!preview.success) return preview;

    const write = await this.repository.updateSeason(year, {
      awards: preview.data,
      status: 'complete',
    });
    if (!write.success) return write;

    // Blunt by design: guarantees season:{year} AND seasons:all refresh.
    this.scoreService.clearCache();
    return preview;
  }
}
