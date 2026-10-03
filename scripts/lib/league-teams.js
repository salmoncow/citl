/**
 * league-teams.js — plan leagueTeams/{teamId} docs from season team docs
 * (spec 009 AC-1, DD-5). Shared by backfill-league-teams.js and the
 * emulator seed. Pure: no Firestore access.
 *
 * League team identity = the season team doc id (the name slug), so the
 * same id across seasons is the same team. `name` comes from the latest
 * season. An existing doc keeps its captainUid and gains any new seasons.
 */

/**
 * @param {{ year: number, id: string, name: string }[]} seasonTeams
 * @param {Map<string, { name?: string, captainUid?: string | null, seasons?: number[] }>} existing
 * @returns {{ id: string, create: boolean, data: { name: string, seasons: number[], captainUid?: null } }[]}
 *   Only docs that need a write. `captainUid` is set (to null) on create only.
 */
export function planLeagueTeams(seasonTeams, existing) {
  const byId = new Map();
  for (const t of seasonTeams) {
    const cur = byId.get(t.id);
    if (!cur) {
      byId.set(t.id, { seasons: new Set([t.year]), latestYear: t.year, name: t.name });
      continue;
    }
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
    if (!prev) {
      plan.push({ id, create: true, data: { name: t.name, seasons, captainUid: null } });
      continue;
    }
    const sameSeasons = seasons.length === (prev.seasons ?? []).length;
    if (sameSeasons && prev.name === t.name) continue;
    plan.push({ id, create: false, data: { name: t.name, seasons } });
  }
  return plan;
}

/**
 * Read every season's teams and the existing league teams, then apply the
 * plan. Never writes seasons/**.
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {{ dryRun?: boolean, FieldValue: typeof import('firebase-admin/firestore').FieldValue }} opts
 */
export async function syncLeagueTeams(db, { dryRun = false, FieldValue }) {
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
  const plan = planLeagueTeams(seasonTeams, existing);

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
