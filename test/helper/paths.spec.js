const path = require('path');
const { isRemotePathAtOrUnder, isLocalPathAtOrUnder } = require('../../src/helper/paths');

describe('isRemotePathAtOrUnder', () => {
  test('matches the base itself', () => {
    expect(isRemotePathAtOrUnder('/var/www', '/var/www')).toBe(true);
  });

  test('matches descendants', () => {
    expect(isRemotePathAtOrUnder('/var/www', '/var/www/index.php')).toBe(true);
    expect(isRemotePathAtOrUnder('/var/www', '/var/www/a/b/c.txt')).toBe(true);
  });

  test('does not match siblings that share a name prefix', () => {
    expect(isRemotePathAtOrUnder('/var/www', '/var/wwwroot')).toBe(false);
    expect(isRemotePathAtOrUnder('/var/www', '/var/www2/index.php')).toBe(false);
  });

  test('does not match ancestors or unrelated paths', () => {
    expect(isRemotePathAtOrUnder('/var/www', '/var')).toBe(false);
    expect(isRemotePathAtOrUnder('/var/www', '/srv/www/index.php')).toBe(false);
  });

  test('ignores trailing slashes on either side', () => {
    expect(isRemotePathAtOrUnder('/var/www/', '/var/www')).toBe(true);
    expect(isRemotePathAtOrUnder('/var/www', '/var/www/sub/')).toBe(true);
  });

  test('treats the filesystem root as containing everything', () => {
    expect(isRemotePathAtOrUnder('/', '/')).toBe(true);
    expect(isRemotePathAtOrUnder('/', '/var/www')).toBe(true);
  });

  test('resolves . and .. before comparing', () => {
    expect(isRemotePathAtOrUnder('/var/www', '/var/www/./sub')).toBe(true);
    expect(isRemotePathAtOrUnder('/var/www', '/var/www/sub/../other')).toBe(true);
    expect(isRemotePathAtOrUnder('/var/www', '/var/www/../etc/passwd')).toBe(false);
  });
});

describe('isLocalPathAtOrUnder', () => {
  const root = path.join(path.sep, 'work', 'project');
  const src = path.join(root, 'src');

  test('matches the base itself', () => {
    expect(isLocalPathAtOrUnder(src, src)).toBe(true);
  });

  test('matches descendants', () => {
    expect(isLocalPathAtOrUnder(src, path.join(src, 'index.ts'))).toBe(true);
    expect(isLocalPathAtOrUnder(src, path.join(src, 'a', 'b', 'c.ts'))).toBe(true);
  });

  test('does not match siblings that share a name prefix', () => {
    expect(isLocalPathAtOrUnder(src, `${src}-legacy`)).toBe(false);
    expect(isLocalPathAtOrUnder(src, path.join(`${src}2`, 'index.ts'))).toBe(false);
  });

  test('does not match ancestors', () => {
    expect(isLocalPathAtOrUnder(src, root)).toBe(false);
  });

  test('ignores trailing separators', () => {
    expect(isLocalPathAtOrUnder(src + path.sep, src)).toBe(true);
    expect(isLocalPathAtOrUnder(src, path.join(src, 'sub') + path.sep)).toBe(true);
  });

  test('resolves . and .. before comparing', () => {
    expect(isLocalPathAtOrUnder(src, path.join(src, '.', 'sub'))).toBe(true);
    expect(isLocalPathAtOrUnder(src, path.join(src, '..', 'dist'))).toBe(false);
  });
});
