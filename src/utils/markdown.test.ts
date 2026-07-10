// @vitest-environment jsdom
/**
 * Regression tests for the stored-XSS fix (commit c11b79a).
 *
 * renderMarkdown output is injected via innerHTML on the public
 * homepage (home-announcements), so it must neutralize script-bearing
 * payloads regardless of future marked/dompurify upgrades or
 * refactors — none of the other suites would catch the sanitize
 * wrapper being dropped.
 */

import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown — XSS neutralization', () => {
  it('strips the original payload class: <img src=x onerror=...>', () => {
    const out = renderMarkdown('hello <img src=x onerror="alert(1)"> world');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('alert(1)');
    expect(out).toContain('hello');
    expect(out).toContain('world');
  });

  it('strips <script> blocks', () => {
    const out = renderMarkdown('before\n\n<script>alert(1)</script>\n\nafter');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
    expect(out).toContain('before');
    expect(out).toContain('after');
  });

  it('removes javascript: hrefs from markdown links', () => {
    const out = renderMarkdown('[click me](javascript:alert(1))');
    expect(out).not.toContain('javascript:');
  });

  it('strips inline event handlers on arbitrary elements', () => {
    const out = renderMarkdown('<div onclick="alert(1)">hi</div>');
    expect(out).not.toContain('onclick');
    expect(out).toContain('hi');
  });
});

describe('renderMarkdown — deliberate behaviors', () => {
  it('strips markdown images (renderer.image override)', () => {
    const out = renderMarkdown('![alt text](https://example.com/x.png)');
    expect(out).not.toContain('<img');
  });

  it('renders GFM line breaks as <br>', () => {
    const out = renderMarkdown('line one\nline two');
    expect(out).toContain('<br');
  });

  it('preserves benign formatting and safe links', () => {
    const out = renderMarkdown('**bold** and [site](https://example.com/)');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('href="https://example.com/"');
  });
});
