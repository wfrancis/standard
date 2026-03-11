import OpenAI from 'openai';

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

export default getOpenAI;

export async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const error = err as { status?: number; headers?: Record<string, string> };
      if (error?.status === 429 && attempt < maxRetries) {
        const retryAfter = parseInt(error.headers?.['retry-after'] ?? '2');
        const jitter = Math.random() * 1000;
        await new Promise(r => setTimeout(r, retryAfter * 1000 + jitter));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Unreachable');
}
