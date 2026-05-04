/**
 * Roster modal — Team Management's per-team shooter editor.
 *
 * Self-contained: each `openRosterModal()` call builds and shows a
 * single `<dialog>`, mutates internal state for the duration of the
 * edit, and tears down on save/cancel. State lives in the closure so
 * the dialog has no shared lifetime with the parent tab.
 */

import { ScoreService } from '@/services/score-service';
import { showToast } from '@/modules/ui';
import { normalizeShooterName } from '@/services/scoring-engine';
import type { Shooter } from '@/types/shooter';
import type { Team } from '@/types/score';
import { attachAutocomplete, setStatus } from './admin-shared';
import type { AdminTabContext } from './types';

export interface RosterModalOptions {
  teamId: string;
  teamName: string;
  ctx: AdminTabContext;
  scoreService: ScoreService;
  /** Called after a successful save so the parent can refresh its team list. */
  onSaved: () => void;
}

export function openRosterModal(opts: RosterModalOptions): void {
  const { teamId, teamName, ctx, scoreService, onSaved } = opts;
  let originalShooters: Shooter[] = [];
  /** Shooter names removed from roster DOM but not yet written to Firestore. */
  const pendingRemovals: string[] = [];

  // ── Build dialog ───────────────────────────────────────────────────────
  const dialog = document.createElement('dialog');
  dialog.className = 'roster-dialog';

  const header = document.createElement('div');
  header.className = 'roster-dialog__header';
  const title = document.createElement('h2');
  title.className = 'roster-dialog__title';
  title.textContent = `Edit Roster — ${teamName}`;
  header.appendChild(title);

  const table = document.createElement('table');
  table.className = 'admin-roster-table';
  const thead = table.createTHead();
  const hrow = thead.insertRow();
  for (const label of ['Name', 'W0 Avg', 'Rookie', '']) {
    const th = document.createElement('th');
    th.textContent = label;
    hrow.appendChild(th);
  }
  const tbody = table.createTBody();

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'admin-table-wrapper';
  tableWrapper.appendChild(table);

  const footer = document.createElement('div');
  footer.className = 'roster-dialog__footer';

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn-secondary';
  addBtn.textContent = 'Add Shooter';

  const rightActions = document.createElement('div');
  rightActions.className = 'admin-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn-secondary';
  cancelBtn.textContent = 'Cancel';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = 'Save Roster';

  rightActions.append(cancelBtn, saveBtn);
  footer.append(addBtn, rightActions);

  const statusEl = document.createElement('p');
  statusEl.className = 'admin-status';
  statusEl.setAttribute('aria-live', 'polite');

  dialog.append(header, tableWrapper, footer, statusEl);
  document.body.appendChild(dialog);

  const setRosterStatus = (message: string, type: '' | 'success' | 'error' | 'info') => {
    setStatus(statusEl, message, type);
  };

  const close = () => {
    dialog.close();
    document.body.removeChild(dialog);
  };

  const namedRosterCount = () =>
    [...tbody.querySelectorAll<HTMLElement>('.ap-roster-row')]
      .filter((r) => Boolean(r.querySelector<HTMLInputElement>('.ap-roster-name')?.value.trim()))
      .length;

  const addRosterRow = (shooter?: Shooter, originalIndex?: number) => {
    const row = document.createElement('tr');
    row.className = 'ap-roster-row';
    if (originalIndex !== undefined) {
      row.dataset['originalIndex'] = String(originalIndex);
    }

    if (shooter !== undefined) {
      row.dataset['startingAvg'] = String(shooter.startingAvg);
      row.dataset['rookie'] = String(shooter.rookie);
    } else {
      // New shooter: league defaults
      row.dataset['startingAvg'] = '35';
      row.dataset['rookie'] = 'true';
    }

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'ap-roster-name';
    nameInput.placeholder = 'Shooter name';
    nameInput.autocomplete = 'off';
    if (shooter) nameInput.value = shooter.name;

    const avgSpan = document.createElement('span');
    avgSpan.className = 'ap-roster-avg-display';
    const rookieSpan = document.createElement('span');
    rookieSpan.className = 'ap-roster-rookie-display';

    if (shooter !== undefined) {
      avgSpan.textContent = String(shooter.startingAvg);
      rookieSpan.textContent = shooter.rookie ? 'Yes' : 'No';
    } else {
      avgSpan.textContent = '—';
      rookieSpan.textContent = '—';

      nameInput.addEventListener('blur', () => {
        const name = nameInput.value.trim();
        if (!name) return;
        const year = ctx.getYear();
        avgSpan.textContent = '…';
        rookieSpan.textContent = '…';
        void scoreService.computeShooterDefaults(year, name).then((result) => {
          if (!result.success) {
            avgSpan.textContent = '35';
            rookieSpan.textContent = 'Yes';
            return;
          }
          // cross-team duplicate check
          const conflict = ctx.getTeamsData()?.find(
            (t) => t.id !== teamId &&
              t.shooters.some((s) => normalizeShooterName(s.name) === normalizeShooterName(name)),
          );
          if (conflict) {
            showToast('error', `"${name}" is already on team "${conflict.name}".`);
            nameInput.value = '';
            avgSpan.textContent = '—';
            rookieSpan.textContent = '—';
            return;
          }
          row.dataset['startingAvg'] = String(result.data.startingAvg);
          row.dataset['rookie']      = String(result.data.rookie);
          avgSpan.textContent   = String(result.data.startingAvg);
          rookieSpan.textContent = result.data.rookie ? 'Yes' : 'No';
        });
      });
    }

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '✕';
    removeBtn.className = 'ap-remove-shooter';
    removeBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (name && namedRosterCount() <= 5) {
        setRosterStatus('Teams must have at least 5 shooters — cannot remove.', 'error');
        return;
      }
      setRosterStatus('', '');
      // Existing shooter with a name: defer cascade removal to Save Roster
      if (originalIndex !== undefined && name) {
        pendingRemovals.push(name);
      }
      tbody.removeChild(row);
    });

    const td = (child: HTMLElement) => {
      const c = document.createElement('td');
      c.appendChild(child);
      return c;
    };
    row.appendChild(td(nameInput));
    if (shooter === undefined) {
      attachAutocomplete(nameInput, () => ctx.getCachedShooterNames());
    }
    const avgCell = document.createElement('td');
    avgCell.appendChild(avgSpan);
    row.appendChild(avgCell);
    const rookieCell = document.createElement('td');
    rookieCell.appendChild(rookieSpan);
    row.appendChild(rookieCell);
    row.appendChild(td(removeBtn));
    tbody.appendChild(row);
  };

  const saveRoster = async () => {
    const year = ctx.getYear();
    const teams = ctx.getTeamsData();

    // Captain comes from team data; derive from first shooter row if blank
    let captain = teams?.find((t) => t.id === teamId)?.captain ?? '';
    if (!captain) {
      captain = tbody.querySelector<HTMLInputElement>('.ap-roster-name')?.value.trim() ?? '';
    }
    if (!captain) {
      setRosterStatus('Add at least one shooter to set a captain.', 'error');
      return;
    }

    const shooters: Shooter[] = [];
    for (const rowEl of tbody.querySelectorAll<HTMLElement>('.ap-roster-row')) {
      const name = rowEl.querySelector<HTMLInputElement>('.ap-roster-name')!.value.trim();
      if (!name) continue;

      const startingAvgRaw = parseFloat(rowEl.dataset['startingAvg'] ?? '35');
      const startingAvg = isNaN(startingAvgRaw) ? 35 : startingAvgRaw;
      const rookie = rowEl.dataset['rookie'] === 'true';

      const origIdxStr = rowEl.dataset['originalIndex'];
      const origIdx = origIdxStr !== undefined ? parseInt(origIdxStr, 10) : NaN;
      const original = !isNaN(origIdx) ? originalShooters[origIdx] : undefined;

      shooters.push({
        id: original?.id ?? '',
        name,
        rookie,
        startingAvg,
        finalAvg: original?.finalAvg ?? null,
        weeksShot: original?.weeksShot ?? null,
        scores: original?.scores ?? [],
      });
    }

    if (shooters.length < 5) {
      setRosterStatus('A team must have at least 5 shooters.', 'error');
      return;
    }

    setRosterStatus('', '');
    const displayName = teams?.find((t) => t.id === teamId)?.name ?? teamId;
    saveBtn.disabled = true;

    // Process deferred shooter removals before saving
    for (const name of pendingRemovals) {
      await scoreService.removeShooterFromRoster(year, teamId, name);
    }
    pendingRemovals.length = 0;

    const result = await scoreService.saveTeamRoster(year, teamId, captain, shooters);
    saveBtn.disabled = false;

    if (result.success) {
      showToast('success', `Roster saved — ${displayName}.`);
      close();
      onSaved();
    } else {
      showToast('error', `Failed to save roster: ${result.error}`);
    }
  };

  // ── Wire events ─────────────────────────────────────────────────────────
  addBtn.addEventListener('click', () => addRosterRow());
  cancelBtn.addEventListener('click', close);
  saveBtn.addEventListener('click', () => void saveRoster());
  dialog.addEventListener('cancel', close);

  dialog.showModal();

  // Prefetch shooter name suggestions for autocomplete
  void ctx.getShooterSuggestions(ctx.getYear());

  // ── Load roster data (async) ────────────────────────────────────────────
  void (async () => {
    setRosterStatus('Loading roster…', 'info');
    const result = await scoreService.computeRosterDefaults(ctx.getYear(), teamId);
    setRosterStatus('', '');

    let team: Team;
    if (result.success) {
      team = result.data;
    } else {
      console.warn('computeRosterDefaults failed, using cached data:', result.error);
      const fallback = ctx.getTeamsData()?.find((t) => t.id === teamId);
      if (!fallback) return;
      team = fallback;
    }

    originalShooters = [...team.shooters];
    for (let i = 0; i < team.shooters.length; i++) {
      addRosterRow(team.shooters[i], i);
    }
  })();
}
