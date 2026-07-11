const { withRetry } = require('../../src/helper/retry');
const { isConnectionError } = require('../../src/helper/error');

describe('isConnectionError', () => {
  test('returns true for common connection error messages', () => {
    expect(isConnectionError(new Error('read ECONNRESET'))).toBe(true);
    expect(isConnectionError(new Error('connect ETIMEDOUT 1.2.3.4:22'))).toBe(true);
    expect(isConnectionError(new Error('connect ECONNREFUSED 1.2.3.4:22'))).toBe(true);
    expect(isConnectionError(new Error('write EPIPE'))).toBe(true);
    expect(isConnectionError(new Error('Connection closed by server'))).toBe(true);
    expect(isConnectionError(new Error('Connection lost before handshake'))).toBe(true);
    expect(isConnectionError(new Error('No response from server'))).toBe(true);
    expect(isConnectionError(new Error('Unable to start subsystem: sftp'))).toBe(true);
    expect(isConnectionError(new Error('Socket closed'))).toBe(true);
    expect(isConnectionError(new Error('Server closed connection'))).toBe(true);
    expect(isConnectionError(new Error('Client is closed'))).toBe(true);
    expect(isConnectionError(new Error('Connection ended unexpectedly'))).toBe(true);
    expect(isConnectionError(new Error('received FIN from server'))).toBe(true);
  });

  test('returns true when error code indicates a connection problem', () => {
    const err = new Error('Something went wrong');
    err.code = 'ECONNRESET';
    expect(isConnectionError(err)).toBe(true);
  });

  test('returns false for unrelated errors', () => {
    expect(isConnectionError(new Error('Permission denied'))).toBe(false);
    expect(isConnectionError(new Error('File not found'))).toBe(false);
    expect(isConnectionError(new Error('Parse error on line 42'))).toBe(false);
    expect(isConnectionError(null)).toBe(false);
    expect(isConnectionError(undefined)).toBe(false);
    expect(isConnectionError('string error')).toBe(false);
  });
});

describe('withRetry', () => {
  test('returns the result on the first attempt when operation succeeds', async () => {
    const operation = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(operation, { shouldRetry: () => true });
    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  test('retries when shouldRetry returns true and eventually succeeds', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValue('ok');
    const onRetry = jest.fn();

    const result = await withRetry(operation, {
      maxAttempts: 2,
      shouldRetry: () => true,
      onRetry,
    });

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
  });

  test('stops retrying after maxAttempts and throws the last error', async () => {
    const lastError = new Error('still broken');
    const operation = jest.fn().mockRejectedValue(lastError);
    const onRetry = jest.fn();

    await expect(
      withRetry(operation, {
        maxAttempts: 3,
        shouldRetry: () => true,
        onRetry,
      })
    ).rejects.toBe(lastError);

    expect(operation).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  test('does not retry when shouldRetry returns false', async () => {
    const error = new Error('do not retry');
    const operation = jest.fn().mockRejectedValue(error);

    await expect(
      withRetry(operation, {
        maxAttempts: 3,
        shouldRetry: () => false,
      })
    ).rejects.toBe(error);

    expect(operation).toHaveBeenCalledTimes(1);
  });

  test('uses default maxAttempts of 2', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockResolvedValue('ok');

    await withRetry(operation, { shouldRetry: () => true });
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
