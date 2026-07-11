export interface RetryOptions {
  maxAttempts?: number;
  shouldRetry: (err: unknown) => boolean;
  onRetry?: (err: unknown, attempt: number) => void;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts || !options.shouldRetry(err)) {
        throw err;
      }
      if (options.onRetry) {
        options.onRetry(err, attempt);
      }
    }
  }

  throw lastError;
}
