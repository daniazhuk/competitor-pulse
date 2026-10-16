import { describe, expect, it } from 'vitest';
import { listing } from '../test/test-context.js';
import { OpenAiSummarizer } from './openai-summarizer.js';

const input = {
  competitorId: 'acme-crm',
  previous: listing(),
  current: listing({ price: '$39/mo' }),
  changes: [{ field: 'price' as const, before: '$29/mo', after: '$39/mo' }],
};

const createSummarizer = (fetchImpl: typeof fetch, timeoutMs = 1_000) =>
  new OpenAiSummarizer({
    baseUrl: 'http://llm.test/v1/',
    apiKey: 'secret',
    model: 'test-model',
    timeoutMs,
    fetch: fetchImpl,
  });

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('OpenAiSummarizer', () => {
  it('sends the diff and both listings and returns the trimmed completion', async () => {
    let request: { url: string; init: RequestInit | undefined } | undefined;
    const summarizer = createSummarizer((url, init) => {
      request = { url: url instanceof Request ? url.url : url.toString(), init };
      return Promise.resolve(
        jsonResponse({ choices: [{ message: { content: '  Price rose to $39/mo.  ' } }] }),
      );
    });

    await expect(summarizer.summarize(input)).resolves.toBe('Price rose to $39/mo.');

    expect(request?.url).toBe('http://llm.test/v1/chat/completions');
    expect(new Headers(request?.init?.headers).get('authorization')).toBe('Bearer secret');
    const body = request?.init?.body;
    const userMessage = typeof body === 'string' ? body : '';
    expect(userMessage).toContain('price: \\"$29/mo\\" -> \\"$39/mo\\"');
    expect(userMessage).toContain('Previous listing');
  });

  it('fails on non-2xx responses', async () => {
    const summarizer = createSummarizer(() =>
      Promise.resolve(jsonResponse({ error: 'boom' }, 500)),
    );
    await expect(summarizer.summarize(input)).rejects.toThrow('HTTP 500');
  });

  it('fails on an unexpected response shape', async () => {
    const summarizer = createSummarizer(() => Promise.resolve(jsonResponse({ choices: [] })));
    await expect(summarizer.summarize(input)).rejects.toThrow('no choices');
  });

  it('aborts requests that exceed the timeout', async () => {
    const hangingFetch: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      });
    await expect(createSummarizer(hangingFetch, 20).summarize(input)).rejects.toThrow();
  });
});
