/**
 * preview-bar — "this is not the official site" bar for preview builds.
 *
 * Shown only when the build sets VITE_PREVIEW_SITE=true, which
 * .github/workflows/deploy-preview.yml and `npm run deploy:preview` do
 * for the citl-preview Hosting site. Production builds never set it, so
 * Vite replaces the check with false and the bar never renders there.
 * scripts/preview-site-config.js refuses to deploy a preview build
 * without it (PREVIEW_MARKER below).
 */

/** Searched for in dist/ by scripts/preview-site-config.js; keep in sync. */
export const PREVIEW_MARKER = 'citl-preview-build';

export function mountPreviewBar(): void {
  if (import.meta.env.VITE_PREVIEW_SITE !== 'true') return;
  const bar = document.createElement('div');
  bar.className = 'preview-bar';
  bar.dataset['marker'] = PREVIEW_MARKER;
  bar.setAttribute('role', 'note');
  bar.innerHTML =
    '<p class="preview-bar__text">Preview build for testing. The official site is ' +
    '<a href="https://citl.club/">citl.club</a>. Anything you change here changes real league data.</p>';
  // After the skip link, so that stays the first focus stop.
  const skip = document.querySelector('.skip-link');
  if (skip) skip.after(bar);
  else document.body.prepend(bar);
}
