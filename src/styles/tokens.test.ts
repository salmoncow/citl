/**
 * Design-token contract (constitution §IV.1, spec 007).
 *
 * - The two dark-mode blocks in tokens.css (OS preference and explicit
 *   toggle) stay identical, and only redefine semantic tokens that the light
 *   :root already declares.
 * - Component stylesheets carry no colour literals; colours live in
 *   tokens.css (print.css is exempt: print forces black on white).
 * - Primitives (--color-*) are referenced only inside tokens.css.
 * - Every var(--x) used anywhere in src/ is defined in a stylesheet.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '..');
const STYLES = __dirname;
const LITERAL_EXEMPT = new Set(['tokens.css', 'print.css']);

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Body of the first `{…}` block whose selector text ends with `selector`. */
function blockBody(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`selector not found: ${selector}`);
  let i = css.indexOf('{', start) + 1;
  const bodyStart = i;
  let depth = 1;
  while (depth > 0 && i < css.length) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }
  return css.slice(bodyStart, i - 1);
}

function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(m[1]!, m[2]!.trim().replace(/\s+/g, ' '));
  }
  return out;
}

function filesUnder(dir: string, ext: string[]): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((d) => d.isFile() && ext.some((e) => d.name.endsWith(e)) && !d.name.endsWith('.test.ts'))
    .map((d) => path.join(d.parentPath, d.name));
}

const tokensCss = stripComments(readFileSync(path.join(STYLES, 'tokens.css'), 'utf8'));
const light = declarations(blockBody(tokensCss, ':root'));
const darkOs = declarations(blockBody(tokensCss, ':root:not([data-color-scheme="light"])'));
const darkToggle = declarations(blockBody(tokensCss, ':root[data-color-scheme="dark"]'));

describe('tokens.css dark-mode parity', () => {
  it('parses all three blocks', () => {
    expect(light.size).toBeGreaterThan(50);
    expect(darkOs.size).toBeGreaterThan(20);
  });

  it('keeps the OS-preference and explicit-toggle dark blocks identical', () => {
    expect(Object.fromEntries(darkToggle)).toEqual(Object.fromEntries(darkOs));
  });

  it('only redefines tokens the light :root declares', () => {
    const orphans = [...darkOs.keys()].filter((k) => !light.has(k));
    expect(orphans).toEqual([]);
  });

  it('never redefines primitives in dark mode', () => {
    const primitives = [...darkOs.keys()].filter((k) => k.startsWith('--color-'));
    expect(primitives).toEqual([]);
  });
});

describe('component stylesheets', () => {
  const sheets = readdirSync(STYLES).filter((f) => f.endsWith('.css'));

  it('contain no colour literals outside tokens.css and print.css', () => {
    const hits: string[] = [];
    for (const f of sheets.filter((s) => !LITERAL_EXEMPT.has(s))) {
      const css = stripComments(readFileSync(path.join(STYLES, f), 'utf8'));
      css.split('\n').forEach((line, i) => {
        if (/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\(|:\s*(white|black)\b/.test(line)) {
          hits.push(`${f}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });

  it('reference primitives (--color-*) only inside tokens.css', () => {
    const hits = filesUnder(SRC, ['.css', '.ts'])
      .filter((f) => path.basename(f) !== 'tokens.css')
      .filter((f) => /var\(--color-/.test(readFileSync(f, 'utf8')))
      .map((f) => path.relative(SRC, f));
    expect(hits).toEqual([]);
  });

  it('define every custom property referenced in src/', () => {
    const defined = new Set<string>();
    for (const f of sheets) {
      const css = stripComments(readFileSync(path.join(STYLES, f), 'utf8'));
      for (const m of css.matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1]!);
    }
    const missing = new Set<string>();
    for (const f of filesUnder(SRC, ['.css', '.ts'])) {
      for (const m of readFileSync(f, 'utf8').matchAll(/var\((--[\w-]+)/g)) {
        if (!defined.has(m[1]!)) missing.add(`${m[1]} (${path.relative(SRC, f)})`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
