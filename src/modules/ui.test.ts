/**
 * escapeHtml must be safe in BOTH text and quoted-attribute positions:
 * callers (admin-users-panel) interpolate it into attribute values like
 * aria-label="...", where an unescaped quote allows attribute injection.
 */

import { describe, expect, it } from 'vitest';
import { escapeHtml } from './ui';

describe('escapeHtml', () => {
  it('escapes all five HTML-significant characters', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('neutralizes attribute-breakout payloads (no raw quotes survive)', () => {
    const escaped = escapeHtml('" autofocus onfocus="alert(1)');
    expect(escaped).not.toContain('"');
    expect(escaped).not.toContain("'");
    expect(escaped).toBe('&quot; autofocus onfocus=&quot;alert(1)');
  });

  it('escapes ampersands without double-escaping entities specially', () => {
    // Already-encoded input is re-encoded — callers must pass raw strings.
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
    expect(escapeHtml('Bucks & Does')).toBe('Bucks &amp; Does');
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('plain text 123 —')).toBe('plain text 123 —');
  });

  it('coerces non-string input safely', () => {
    expect(escapeHtml(String(42))).toBe('42');
  });
});
