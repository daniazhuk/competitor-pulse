import { z } from 'zod';
import type { ChangeSummarizer, ChangeSummaryInput } from './change-summarizer.js';
import { buildUserPrompt, SYSTEM_PROMPT } from './prompt.js';

const MAX_SUMMARY_LENGTH = 1_000;
const MAX_ERROR_BODY_LENGTH = 300;

const chatCompletionSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().trim().min(1) }) })),
});

export interface OpenAiSummarizerOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  fetch?: typeof fetch;
}

class LlmRequestError extends Error {
  override name = 'LlmRequestError';
}

/**
 * Talks to any OpenAI Chat Completions compatible endpoint (OpenAI, Ollama, the
 * provided mock server). Retries are not done here: the summary worker owns
 * retry/backoff so attempts survive restarts and never block polling.
 */
export class OpenAiSummarizer implements ChangeSummarizer {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: OpenAiSummarizerOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  async summarize(input: ChangeSummaryInput): Promise<string> {
    const url = `${this.options.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify({
        model: this.options.model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(input) },
        ],
      }),
      signal: AbortSignal.timeout(this.options.timeoutMs),
    });

    if (!response.ok) {
      const body = (await response.text()).slice(0, MAX_ERROR_BODY_LENGTH);
      throw new LlmRequestError(`LLM responded with HTTP ${response.status}: ${body}`);
    }

    const parsed = chatCompletionSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new LlmRequestError(`Unexpected LLM response shape: ${parsed.error.message}`);
    }

    const content = parsed.data.choices[0]?.message.content;
    if (!content) throw new LlmRequestError('LLM response contained no choices');
    return content.slice(0, MAX_SUMMARY_LENGTH);
  }
}
