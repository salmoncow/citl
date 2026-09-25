/**
 * Score Entry presentation helpers (spec 006 DD-12): the live calculation
 * panel, the team entry-status chips, and the ±1 bunker steppers used on
 * phones. Pure rendering / DOM builders — no data access, no scoring logic.
 */

import { escapeHtml } from '@/modules/ui';
import type { TeamNightPreview } from '@/services/score-entry-preview';
import type { Team } from '@/types/score';

const MAX_SCORE = 25;

function tile(label: string, value: string, sub: string, accent = false): string {
  return `
    <div class="ap-calc__tile">
      <span class="ap-calc__label">${label}</span>
      <span class="ap-calc__value num${accent ? ' ap-calc__value--accent' : ''}">${value}</span>
      <span class="ap-calc__sub">${sub}</span>
    </div>`;
}

/** Live calculation panel markup; an empty string hides it. */
export function renderPreviewPanel(p: TeamNightPreview | null): string {
  if (!p || p.shootersCounted === 0) return '';
  const delta = p.teamTotal - p.goingInSum;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';

  let rookieSub: string;
  if (p.rookieWindowClosed) rookieSub = 'No rookie points after Week 10';
  else if (p.rookieNotes.length === 0) rookieSub = 'No rookies shooting';
  else {
    rookieSub = p.rookieNotes
      .map((r) => `${escapeHtml(r.name)} at ${r.goingIn.toFixed(1)}${r.qualifies ? ' ✓' : ' · needs &lt; 35'}`)
      .join('; ');
  }

  const yard = p.yardage;
  return `
    <div class="ap-calc on-dark">
      <div class="ap-calc__grid">
        ${tile('Team total', String(p.teamTotal), `of ${p.shootersCounted * 50}`)}
        ${tile('Vs going-in', `${sign}${Math.abs(delta).toFixed(1)}`, `${p.goingInSum.toFixed(1)} → ${p.targetBonus ? '+5 bonus' : 'no bonus'}`, delta > 0)}
        ${tile('Rookie bonus', `+${p.rookieBonus}`, rookieSub)}
        ${tile('Yardage', yard ? `${yard.yards} yd` : '—', yard ? `sum ${p.goingInSum.toFixed(1)} · ${yard.min.toFixed(2)}–${yard.max.toFixed(2)}` : 'needs going-in averages')}
      </div>
      <p class="ap-calc__note">Preview — Publish computes the official result.</p>
    </div>`;
}

/** Entered / pending chips for the selected week; the click target carries data-team-id. */
export function renderTeamStatus(teams: Team[], enteredIds: Set<string>, selectedId: string): string {
  if (teams.length === 0) return '';
  const chips = teams.map((t) => {
    const selected = t.id === selectedId;
    const state = selected ? 'Editing' : enteredIds.has(t.id) ? 'Entered' : 'Pending';
    return `
      <button type="button" class="ap-team-chip ap-team-chip--${state.toLowerCase()}" data-team-id="${escapeHtml(t.id)}" aria-pressed="${selected}">
        <span class="ap-team-chip__name">${escapeHtml(t.name)}</span>
        <span class="ap-team-chip__state"><span class="ap-team-chip__dot" aria-hidden="true"></span>${state}</span>
      </button>`;
  }).join('');
  const entered = teams.filter((t) => enteredIds.has(t.id)).length;
  return `
    <p class="ap-draft-pill"><span class="ap-draft-pill__dot" aria-hidden="true"></span>${entered} of ${teams.length} teams entered · not published</p>
    <div class="ap-team-chips">${chips}</div>`;
}

/**
 * Wrap a bunker score input with −/+ buttons (shown on phones by CSS). The
 * buttons write to the same input, clamped 0–25, and fire `input` so totals,
 * preview and the save path all behave exactly as when typing.
 */
export function wrapWithStepper(input: HTMLInputElement, label: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'ap-stepper';
  const make = (delta: number, text: string, aria: string): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ap-stepper__btn';
    b.textContent = text;
    b.setAttribute('aria-label', aria);
    b.addEventListener('click', () => {
      const cur = parseInt(input.value, 10);
      const base = Number.isNaN(cur) ? (delta > 0 ? 0 : MAX_SCORE + 1) : cur;
      input.value = String(Math.min(MAX_SCORE, Math.max(0, base + delta)));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    return b;
  };
  input.setAttribute('aria-label', label);
  wrap.append(make(-1, '−', `Decrease ${label}`), input, make(1, '+', `Increase ${label}`));
  return wrap;
}
