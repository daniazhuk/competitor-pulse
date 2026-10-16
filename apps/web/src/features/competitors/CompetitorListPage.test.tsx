import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompetitorListPage } from './CompetitorListPage';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CompetitorListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CompetitorListPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the empty state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json([]))),
    );
    renderPage();
    expect(await screen.findByText(/No competitors tracked yet/)).toBeInTheDocument();
  });

  it('validates the id on the client before calling the API', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json([])));
    vi.stubGlobal('fetch', fetchMock);
    renderPage();

    await userEvent.type(await screen.findByLabelText('Competitor id'), 'not valid{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(/lowercase letters/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('adds a competitor optimistically and rolls back when the server rejects it', async () => {
    let releaseResponse: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) =>
        init?.method === 'POST'
          ? new Promise<Response>((resolve) => {
              releaseResponse = resolve;
            })
          : Promise.resolve(json([])),
      ),
    );
    renderPage();

    await userEvent.type(await screen.findByLabelText('Competitor id'), 'Acme-CRM{Enter}');
    expect(await screen.findByRole('link', { name: 'acme-crm' })).toBeInTheDocument();

    releaseResponse(
      json({ error: { code: 'UNKNOWN_COMPETITOR', message: 'No listing source' } }, 422),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('No listing source');
    expect(screen.queryByRole('link', { name: 'acme-crm' })).not.toBeInTheDocument();
  });
});
