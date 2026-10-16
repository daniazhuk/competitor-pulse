import type { Listing } from '@competitor-pulse/contract';
import { describe, expect, it } from 'vitest';
import { describeChanges, diffListings } from './diff.js';

const base: Listing = {
  title: 'Acme CRM',
  tagline: 'Simple CRM for small teams',
  price: '$29/mo',
  description: 'Track leads and deals in one place.',
};

describe('diffListings', () => {
  it('reports no changes for the first snapshot', () => {
    expect(diffListings(undefined, base)).toEqual([]);
  });

  it('reports no changes for identical listings', () => {
    expect(diffListings(base, { ...base })).toEqual([]);
  });

  it('reports each changed field with before/after values in a stable order', () => {
    const next = { ...base, description: 'New description', price: '$39/mo' };

    expect(diffListings(base, next)).toEqual([
      { field: 'price', before: '$29/mo', after: '$39/mo' },
      { field: 'description', before: base.description, after: 'New description' },
    ]);
  });

  it('treats whitespace-only edits as changes', () => {
    expect(diffListings(base, { ...base, title: 'Acme CRM ' })).toHaveLength(1);
  });
});

describe('describeChanges', () => {
  it('renders one line per changed field', () => {
    expect(describeChanges([{ field: 'price', before: '$29/mo', after: '$39/mo' }])).toBe(
      'price: "$29/mo" -> "$39/mo"',
    );
  });
});
