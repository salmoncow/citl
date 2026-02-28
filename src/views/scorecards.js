/**
 * scorecardsView — renders the <season-scorecards> Web Component.
 *
 * Data is now loaded from Firestore by the component itself.
 * Static JSON files in src/data/scorecards/ are kept as backup/reference but
 * no longer imported here.
 */

export function scorecardsView() {
  return '<season-scorecards></season-scorecards>';
}
