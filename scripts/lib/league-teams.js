/**
 * league-teams.js — plan leagueTeams/{teamId} docs from season team docs
 * (spec 009 AC-1, DD-5). Shared by backfill-league-teams.js and the
 * emulator seed. Pure: no Firestore access.
 *
 * League team identity = the season team doc id (the name slug), so the
 * same id across seasons is the same team. `name` comes from the latest
 * season. An existing doc keeps its captainUid and gains any new seasons.
 *
 * A renamed team gets a new slug. `merges` maps the old season team id to
 * the current one (`smoking-guns` → `the-smoking-guns`), so both become
 * one league team under the current id, with the old id in `formerIds`.
 */

/**
 * Parse repeated `--merge old=new` arguments into a Map. Throws on a bad
 * pair, a self-merge, or a chain (a target that is also merged away).
 *
 * @param {string[]} argv
 * @returns {Map<string, string>}
 */
export function parseMerges(argv) {
  const merges = new Map();
  argv.forEach((arg, i) => {
    if (arg !== '--merge') return;
    const pair = argv[i + 1] ?? '';
    const [from, to] = pair.split('=');
    if (!from || !to || pair.split('=').length !== 2) throw new Error(`--merge expects old=new, got "${pair}"`);
    if (from === to) throw new Error(`--merge ${pair} merges a team into itself`);
    merges.set(from, to);
  });
  for (const to of merges.values()) {
    if (merges.has(to)) throw new Error(`--merge target "${to}" is itself merged; merge straight into the final id`);
  }
  return merges;
}

/**
 * @param {{ year: number, id: string, name: string }[]} seasonTeams
 * @param {Map<string, { name?: string, captainUid?: string | null, seasons?: number[], formerIds?: string[] }>} existing
 * @param {Map<string, string>} [merges] old season team id → current id
 * @returns {{ id: string, create: boolean, data: { name: string, seasons: number[], captainUid?: null, formerIds?: string[] } }[]}
 *   Only docs that need a write. `captainUid` is set (to null) on create only;
 *   `formerIds` only when a merge applies.
 */
export function planLeagueTeams(seasonTeams, existing, merges = new Map()) {
  const seen = new Set(seasonTeams.map((t) => t.id));
  for (const [from, to] of merges) {
    if (!seen.has(from)) throw new Error(`--merge ${from}=${to}: no season has team "${from}"`);
    if (!seen.has(to)) throw new Error(`--merge ${from}=${to}: no season has team "${to}"`);
  }

  const byId = new Map();
  for (const t of seasonTeams) {
    const id = merges.get(t.id) ?? t.id;
    const cur = byId.get(id);
    if (!cur) {
      byId.set(id, { seasons: new Set([t.year]), latestYear: t.year, name: t.name, formerIds: new Set() });
      if (id !== t.id) byId.get(id).formerIds.add(t.id);
      continue;
    }
    if (id !== t.id) cur.formerIds.add(t.id);
    cur.seasons.add(t.year);
    if (t.year > cur.latestYear) {
      cur.latestYear = t.year;
      cur.name = t.name;
    }
  }

  const plan = [];
  for (const [id, t] of [...byId].sort(([a], [b]) => a.localeCompare(b))) {
    const prev = existing.get(id);
    const seasons = [...new Set([...(prev?.seasons ?? []), ...t.seasons])].sort((a, b) => a - b);
    const formerIds = [...new Set([...(prev?.formerIds ?? []), ...t.formerIds])].sort();
    const extra = formerIds.length ? { formerIds } : {};
    if (!prev) {
      plan.push({ id, create: true, data: { name: t.name, seasons, captainUid: null, ...extra } });
      continue;
    }
    const sameSeasons = seasons.length === (prev.seasons ?? []).length;
    const sameFormer = formerIds.length === (prev.formerIds ?? []).length;
    if (sameSeasons && sameFormer && prev.name === t.name) continue;
    plan.push({ id, create: false, data: { name: t.name, seasons, ...extra } });
  }
  return plan;
}

/**
 * Read every season's teams and the existing league teams, then apply the
 * plan. Never writes seasons/**.
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {{ dryRun?: boolean, merges?: Map<string, string>, FieldValue: typeof import('firebase-admin/firestore').FieldValue }} opts
 */
export async function syncLeagueTeams(db, { dryRun = false, merges = new Map(), FieldValue }) {
  const seasonsSnap = await db.collection('seasons').get();
  const seasonTeams = [];
  const idsByYear = new Map();
  for (const s of seasonsSnap.docs) {
    const year = Number(s.id);
    if (!Number.isInteger(year)) continue;
    const teams = await s.ref.collection('teams').get();
    idsByYear.set(year, teams.docs.map((d) => d.id).sort());
    for (const d of teams.docs) seasonTeams.push({ year, id: d.id, name: String(d.data().name ?? d.id) });
  }

  const existingSnap = await db.collection('leagueTeams').get();
  const existing = new Map(existingSnap.docs.map((d) => [d.id, d.data()]));
  const plan = planLeagueTeams(seasonTeams, existing, merges);

  if (!dryRun && plan.length > 0) {
    const batch = db.batch();
    for (const p of plan) {
      const ref = db.doc(`leagueTeams/${p.id}`);
      if (p.create) {
        batch.create(ref, { ...p.data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      } else {
        batch.update(ref, { ...p.data, updatedAt: FieldValue.serverTimestamp() });
      }
    }
    await batch.commit();
  }
  return { plan, idsByYear };
}
