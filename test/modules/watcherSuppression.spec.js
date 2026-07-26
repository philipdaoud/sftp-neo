const path = require('path');
const {
  SAVE_SUPPRESSION_TTL,
  suppressWatcherFor,
  isWatcherSuppressed,
  releaseWatcherSuppression,
  _reset,
} = require('../../src/modules/watcherSuppression');

const root = path.join(path.sep, 'work', 'project');
const src = path.join(root, 'src');

describe('watcherSuppression', () => {
  beforeEach(() => {
    _reset();
    jest.restoreAllMocks();
  });

  test('nothing is suppressed by default', () => {
    expect(isWatcherSuppressed(path.join(src, 'index.ts'))).toBe(false);
  });

  test('suppresses the exact path', () => {
    suppressWatcherFor(path.join(src, 'index.ts'));
    expect(isWatcherSuppressed(path.join(src, 'index.ts'))).toBe(true);
  });

  test('suppresses descendants, so folder renames cover their contents', () => {
    suppressWatcherFor(src);

    expect(isWatcherSuppressed(path.join(src, 'index.ts'))).toBe(true);
    expect(isWatcherSuppressed(path.join(src, 'a', 'b', 'deep.ts'))).toBe(true);
  });

  test('does not suppress siblings that share a name prefix', () => {
    suppressWatcherFor(src);

    expect(isWatcherSuppressed(`${src}-legacy`)).toBe(false);
    expect(isWatcherSuppressed(path.join(`${src}2`, 'index.ts'))).toBe(false);
  });

  test('does not suppress unrelated paths or ancestors', () => {
    suppressWatcherFor(src);

    expect(isWatcherSuppressed(root)).toBe(false);
    expect(isWatcherSuppressed(path.join(root, 'dist', 'index.js'))).toBe(false);
  });

  test('expires after the ttl', () => {
    const now = 1_000_000;
    const clock = jest.spyOn(Date, 'now');

    clock.mockReturnValue(now);
    suppressWatcherFor(src, 5000);
    expect(isWatcherSuppressed(path.join(src, 'index.ts'))).toBe(true);

    clock.mockReturnValue(now + 4999);
    expect(isWatcherSuppressed(path.join(src, 'index.ts'))).toBe(true);

    clock.mockReturnValue(now + 5001);
    expect(isWatcherSuppressed(path.join(src, 'index.ts'))).toBe(false);
  });

  test('re-suppressing extends the window', () => {
    const now = 1_000_000;
    const clock = jest.spyOn(Date, 'now');

    clock.mockReturnValue(now);
    suppressWatcherFor(src, 5000);

    clock.mockReturnValue(now + 4000);
    suppressWatcherFor(src, 5000);

    clock.mockReturnValue(now + 8000);
    expect(isWatcherSuppressed(path.join(src, 'index.ts'))).toBe(true);
  });

  test('release hands the path back to the watcher immediately', () => {
    suppressWatcherFor(src);
    releaseWatcherSuppression(src);

    expect(isWatcherSuppressed(path.join(src, 'index.ts'))).toBe(false);
  });

  test('releasing one path leaves other suppressions intact', () => {
    const other = path.join(root, 'assets');
    suppressWatcherFor(src);
    suppressWatcherFor(other);

    releaseWatcherSuppression(src);

    expect(isWatcherSuppressed(path.join(src, 'index.ts'))).toBe(false);
    expect(isWatcherSuppressed(path.join(other, 'logo.svg'))).toBe(true);
  });
});

describe('watcherSuppression save window', () => {
  const file = path.join(root, 'src', 'index.ts');

  beforeEach(() => {
    _reset();
    jest.restoreAllMocks();
  });

  test('the save ttl is short enough not to swallow later external edits', () => {
    // The watcher debounces at 550ms, so the window has to clear it, but it
    // should stay well under the time an AI agent would take to rewrite a file.
    expect(SAVE_SUPPRESSION_TTL).toBeGreaterThan(550);
    expect(SAVE_SUPPRESSION_TTL).toBeLessThanOrEqual(5000);
  });

  test('a save claim expires, so a later external write is still uploaded', () => {
    const now = 1_000_000;
    const clock = jest.spyOn(Date, 'now');

    clock.mockReturnValue(now);
    suppressWatcherFor(file, SAVE_SUPPRESSION_TTL);
    expect(isWatcherSuppressed(file)).toBe(true);

    clock.mockReturnValue(now + SAVE_SUPPRESSION_TTL + 1);
    expect(isWatcherSuppressed(file)).toBe(false);
  });

  test('stays suppressed across repeated watcher events within the window', () => {
    // A single write can produce more than one watcher event; every one of
    // them must be dropped, which is why this is not consume-on-first-use.
    const now = 1_000_000;
    const clock = jest.spyOn(Date, 'now');

    clock.mockReturnValue(now);
    suppressWatcherFor(file, SAVE_SUPPRESSION_TTL);

    expect(isWatcherSuppressed(file)).toBe(true);
    expect(isWatcherSuppressed(file)).toBe(true);
    expect(isWatcherSuppressed(file)).toBe(true);
  });

  test('claiming one file does not suppress its siblings', () => {
    suppressWatcherFor(file, SAVE_SUPPRESSION_TTL);

    expect(isWatcherSuppressed(path.join(root, 'src', 'other.ts'))).toBe(false);
  });
});
