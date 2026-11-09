import { it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { sha256 } from '../src/core/sha256';
it('SHA-256 matches the standard implementation', () => {
  for (const s of ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'ملف اختبار ✓', JSON.stringify({ x: [1, 2, 3] }).repeat(500)])
    expect(sha256(s)).toBe(createHash('sha256').update(s, 'utf8').digest('hex'));
});
