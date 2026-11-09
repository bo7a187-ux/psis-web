import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { AR, AR_PATTERNS } from '../src/ar';
import { FIELDS } from '../src/core/fields';
import { DIM_LABEL, RULE_FIELDS, RULE_TYPES } from '../src/core/classify';
import { EXCEPTION_TYPES } from '../src/core/project';
import { WEIGHT_METHODS, PLANNED_METHODS, ACTUAL_SOURCES, CRIT_RULES, BASELINE_USES, FORECAST_METHODS } from '../src/core/settings';

const SRC = join(__dirname, '..', 'src');
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const literalKeys = () => {
  const re = /\btr?\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\$]|\\.)*)`)/g;
  const keys = new Set<string>();
  for (const f of walk(SRC).filter((x) => /\.tsx?$/.test(x) && !x.endsWith('ar.ts') && !x.endsWith('i18n.tsx'))) {
    for (const m of readFileSync(f, 'utf8').matchAll(re)) {
      const raw = m[1] ?? m[2] ?? m[3];
      keys.add(raw.replace(/\\(["'`\\])/g, '$1'));
    }
  }
  return [...keys];
};
const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const tr = (s: string): string => {
  if (AR[s] != null) return AR[s];
  for (const [re, fn] of AR_PATTERNS) { const m = s.match(re); if (m) return fn(m, tr); }
  return s;
};

describe('Arabic interface text', () => {
  it('every text used in the interface has an Arabic translation', () => {
    const missing = literalKeys().filter((k) => AR[k] == null);
    expect(missing).toEqual([]);
  });
  it('labels kept in arrays and objects (menus, columns, steps) are translated too', () => {
    const files = walk(SRC).filter((x) => /\.tsx$/.test(x));
    const re = /\b(?:label|title|h): '([^']+)'|\['([^']+)', '([^']+)'\]|: '([A-Z][^']+)'(?=[,}])/g;
    const found = new Set<string>();
    for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(re)) [m[1], m[2], m[3], m[4]].forEach((x) => x && /[a-z]{2}/.test(x) && found.add(x));
    const ignore = /^(BL Project|Start|Finish|Original Duration \(or|TASK|P6_import)|\(SAMPLE\)$/;
    expect([...found].filter((k) => AR[k] == null && !ignore.test(k))).toEqual([]);
  });
  it('translations keep the same {placeholders}', () => {
    const bad = Object.entries(AR).filter(([en, ar]) => ph(en).join() !== ph(ar).join()).map(([en]) => en);
    expect(bad).toEqual([]);
  });
  it('covers every value shown from the core (fields, lists, methods, exception types)', () => {
    const values = [
      ...FIELDS.map((f) => f.label), ...Object.values(DIM_LABEL), ...RULE_FIELDS, ...RULE_TYPES, ...EXCEPTION_TYPES,
      ...WEIGHT_METHODS, ...PLANNED_METHODS, ...ACTUAL_SOURCES, ...CRIT_RULES, ...BASELINE_USES, ...FORECAST_METHODS,
      ...FORECAST_METHODS.map((m) => m.split(' (')[0]),
      'APPROVED', 'BLOCKED', 'PENDING REVIEW', 'CHANGED SINCE APPROVAL', 'RED', 'AMBER', 'GREEN', 'Critical', 'Warning', 'Info',
    ];
    expect(values.filter((v) => AR[v] == null)).toEqual([]);
  });
  it('translates messages with values inside', () => {
    expect(tr('Forecast 12 days late (red limit 10)')).toBe('التوقع متأخر 12 يوم (الحد الأحمر 10)');
    expect(tr('Behind 3.5 pp (amber limit 2.0)')).toContain('3.5');
    expect(tr('Cannot read "abc" as a duration')).toBe('تعذّرت قراءة "abc" كمدة');
    expect(tr('Baseline Start: Not a real calendar date')).toBe('بداية خط الأساس: ليس تاريخًا صحيحًا في التقويم');
    expect(tr('A1010: duplicate ID')).toBe('A1010: رمز مكرر');
    expect(tr('Some unknown sentence: with colon')).toBe('Some unknown sentence: with colon');
    expect(tr("Primavera XER file - project TWR-P2. Durations converted from hours with each activity's calendar.")).toContain('TWR-P2');
  });
});
