import { describe, expect, it } from 'vitest';
import { competitorIdSchema } from './index.js';

describe('competitorIdSchema', () => {
  it('trims and lowercases input', () => {
    expect(competitorIdSchema.parse('  Acme-CRM ')).toBe('acme-crm');
  });

  it.each(['', '   ', 'acme crm', 'acme--crm', '-acme', 'acme_crm', 'a'.repeat(65)])(
    'rejects %j',
    (input) => {
      expect(competitorIdSchema.safeParse(input).success).toBe(false);
    },
  );
});
