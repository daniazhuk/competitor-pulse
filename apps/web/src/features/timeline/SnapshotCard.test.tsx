import type { Snapshot } from '@competitor-pulse/contract';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SnapshotCard } from './SnapshotCard';

const snapshot = (overrides: Partial<Snapshot> = {}): Snapshot => ({
  id: 's1',
  fetchedAt: '2026-09-10T12:00:00.000Z',
  title: 'Acme CRM',
  tagline: 'Simple CRM for small teams',
  price: '$39/mo',
  description: 'Track leads and deals in one place.',
  changed: true,
  summary: null,
  summaryStatus: 'pending',
  changes: [{ field: 'price', before: '$29/mo', after: '$39/mo' }],
  ...overrides,
});

describe('SnapshotCard', () => {
  it('renders the listing fields and a machine-readable timestamp', () => {
    render(<SnapshotCard snapshot={snapshot()} />);

    expect(screen.getByText('Acme CRM')).toBeInTheDocument();
    expect(screen.getByText('$39/mo')).toBeInTheDocument();
    expect(document.querySelector('time')).toHaveAttribute('datetime', '2026-09-10T12:00:00.000Z');
  });

  it('shows the no-change state', () => {
    render(<SnapshotCard snapshot={snapshot({ changed: false, summaryStatus: 'none' })} />);
    expect(screen.getByText('No change since previous snapshot.')).toBeInTheDocument();
  });

  it('shows the AI summary when ready', () => {
    render(
      <SnapshotCard snapshot={snapshot({ summary: 'Price went up.', summaryStatus: 'ready' })} />,
    );
    expect(screen.getByText('Price went up.')).toBeInTheDocument();
  });

  it('shows a pending state while the summary is generated', () => {
    render(<SnapshotCard snapshot={snapshot()} />);
    expect(screen.getByText('Generating AI summary…')).toBeInTheDocument();
  });

  it('falls back to the deterministic diff when the summary failed', () => {
    render(<SnapshotCard snapshot={snapshot({ summaryStatus: 'failed' })} />);
    expect(screen.getByText('price: "$29/mo" → "$39/mo"')).toBeInTheDocument();
  });
});
