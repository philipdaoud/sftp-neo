const { planMoves } = require('../../src/modules/remoteExplorer/movePlan');

const REMOTE = 1;
const OTHER_REMOTE = 2;

function file(fsPath, remoteId = REMOTE) {
  return { fsPath, remoteId, isDirectory: false };
}

function dir(fsPath, remoteId = REMOTE) {
  return { fsPath, remoteId, isDirectory: true };
}

describe('planMoves', () => {
  test('moves a file into the target folder', () => {
    const plan = planMoves([file('/var/www/index.php')], dir('/var/www/archive'));

    expect(plan.rejection).toBeUndefined();
    expect(plan.moves).toEqual([
      { from: '/var/www/index.php', to: '/var/www/archive/index.php', isDirectory: false },
    ]);
  });

  test('moves a folder into the target folder', () => {
    const plan = planMoves([dir('/var/www/css')], dir('/var/www/assets'));

    expect(plan.moves).toEqual([
      { from: '/var/www/css', to: '/var/www/assets/css', isDirectory: true },
    ]);
  });

  test('moves several items at once', () => {
    const plan = planMoves(
      [file('/var/www/a.txt'), file('/var/www/b.txt')],
      dir('/var/www/archive')
    );

    expect(plan.moves.map(m => m.to)).toEqual([
      '/var/www/archive/a.txt',
      '/var/www/archive/b.txt',
    ]);
  });

  test('dropping into the folder an item already lives in is a no-op', () => {
    const plan = planMoves([file('/var/www/css/main.css')], dir('/var/www/css'));

    expect(plan.rejection).toBeUndefined();
    expect(plan.moves).toEqual([]);
  });

  test('refuses to move a folder into itself', () => {
    const plan = planMoves([dir('/var/www/css')], dir('/var/www/css'));

    expect(plan.moves).toEqual([]);
    expect(plan.rejection).toMatch(/into itself/);
  });

  test('refuses to move a folder into its own descendant', () => {
    const plan = planMoves([dir('/var/www/css')], dir('/var/www/css/vendor/lib'));

    expect(plan.moves).toEqual([]);
    expect(plan.rejection).toMatch(/into itself/);
  });

  test('a folder whose name prefixes the target is not treated as self-nesting', () => {
    const plan = planMoves([dir('/var/www/css')], dir('/var/www/css-legacy'));

    expect(plan.rejection).toBeUndefined();
    expect(plan.moves).toEqual([
      { from: '/var/www/css', to: '/var/www/css-legacy/css', isDirectory: true },
    ]);
  });

  test('refuses drops that cross configurations, without moving anything', () => {
    const plan = planMoves(
      [file('/var/www/a.txt'), file('/var/www/b.txt', OTHER_REMOTE)],
      dir('/var/www/archive')
    );

    expect(plan.moves).toEqual([]);
    expect(plan.rejection).toMatch(/different SFTP configurations/);
  });

  test('drops the inner path when a folder and its contents are both selected', () => {
    const plan = planMoves(
      [dir('/var/www/css'), file('/var/www/css/main.css')],
      dir('/var/www/assets')
    );

    expect(plan.moves).toEqual([
      { from: '/var/www/css', to: '/var/www/assets/css', isDirectory: true },
    ]);
  });

  test('an empty selection plans nothing', () => {
    expect(planMoves([], dir('/var/www'))).toEqual({ moves: [] });
  });

  test('moving up to the root folder works', () => {
    const plan = planMoves([file('/var/www/css/main.css')], dir('/var/www'));

    expect(plan.moves).toEqual([
      { from: '/var/www/css/main.css', to: '/var/www/main.css', isDirectory: false },
    ]);
  });
});
