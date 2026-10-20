jest.mock('fs');

import { vol } from 'memfs';
import * as fs from 'fs';
import * as path from 'path';
import { sync, planSync, executeSyncPlan, syncPlanKey, TransferDirection } from '../transfer';
import localFs from '../../../core/localFs';
import TransferTask from '../../../core/transferTask';
import * as host from '../../../host';
import RemoteFs from '../../../../test/helper/localRemoteFs';

declare global {
  interface Array<T> {
    formatSep(): Array<T>;
  }
}

Array.prototype.formatSep = function() {
  return this.map(str => str.replace(/\//g, path.sep))
}

function createRemoteFs({ remoteTimeOffsetInHours = 0 } = {}) {
  return new RemoteFs(path, {
    clientOption: {} as any,
    remoteTimeOffsetInHours,
  });
}

async function runTasks(tasks: TransferTask[]) {
  return Promise.all(
    tasks.map(async task => {
      try {
        await task.run();
      } catch (error) {
        console.log('run task fail', error);
      }
    })
  );
}

const file = (c, time = 0) => ({
  $$type: 'file',
  content: c,
  mtime: new Date(new Date().getTime() + time * 1000),
});

const fillFs = obj => {
  const files: { [x: string]: string } = {};
  const dirs: string[] = [];
  const stats: {
    [x: string]: {
      mtime: Date;
    };
  } = {};
  const processDirTree = (obj1, filepath = '/') => {
    const keys = Object.keys(obj1);
    if (keys.length <= 0) {
      dirs.push(filepath);
      return;
    }

    keys.forEach(key => {
      const fullpath = path.join(filepath, key);
      if (obj1[key].$$type === 'file') {
        files[fullpath] = obj1[key].content;
        stats[fullpath] = obj1[key];
      } else {
        processDirTree(obj1[key], fullpath);
      }
    });
  };
  processDirTree(obj);
  vol.fromJSON(files, '/');
  dirs.forEach(dir => fs.mkdirSync(dir, { recursive: true }));
  Object.keys(stats).forEach(filepath => {
    fs.utimesSync(filepath, stats[filepath].mtime, stats[filepath].mtime);
  });
};
const mapList = (list: any[], key: string) => list.map(t => t[key]);

describe('transfer algorithm', () => {
  describe('sync', () => {
    afterEach(() => {
      vol.reset();
    });

    test('sync', async () => {
      fillFs({
        local: {
          a: file('a', 1),
          b: file('b', 1),
          c: {
            'c-a': file('c-a', 1),
            'c-b': file('c-b', 1),
            d: {
              'd-a': file('d-a', 1),
              'd-b': file('d-b', 1),
            },
          },
        },
        remote: {
          a: file('$a'),
          $da: file('$da'),
          $db: {},
          c: {
            'c-a': file('$c-a'),
            $dc: file('$dc'),
            d: {
              'd-a': file('$d-a'),
            },
          },
        },
      });

      const task: TransferTask[] = [];
      const collect = (a: TransferTask) => task.push(a);
      const deleted = await sync(
        {
          srcFsPath: '/local',
          srcFs: localFs,
          targetFs: localFs,
          targetFsPath: '/remote',
          transferDirection: TransferDirection.LOCAL_TO_REMOTE,
          transferOption: {
            perserveTargetMode: false,
          },
        },
        collect
      );
      expect(task.length).toEqual(6);
      expect(deleted.length).toEqual(0);
      expect(mapList(task, 'targetFsPath').sort()).toEqual(
        [
          '/remote/a',
          '/remote/b',
          '/remote/c/c-a',
          '/remote/c/c-b',
          '/remote/c/d/d-a',
          '/remote/c/d/d-b',
        ].formatSep().sort()
      );
      // Regression check: nested shared directories must keep the original sync direction.
      expect(task.every(t => t.transferType === TransferDirection.LOCAL_TO_REMOTE)).toBe(true);
    });

    test('sync --delete', async () => {
      fillFs({
        local: {
          a: file('a', 1),
          b: file('b', 1),
          c: {
            'c-a': file('c-a', 1),
            'c-b': file('c-b', 1),
            d: {
              'd-a': file('d-a', 1),
              'd-b': file('d-b', 1),
            },
          },
        },
        remote: {
          a: file('$a'),
          $da: file('$da'),
          $db: {},
          c: {
            'c-a': file('$c-a'),
            $dc: file('$dc'),
            d: {
              'd-a': file('$d-a'),
            },
          },
        },
      });

      const task: TransferTask[] = [];
      const collect = (a: TransferTask) => task.push(a);
      const deleted = await sync(
        {
          srcFsPath: '/local',
          srcFs: localFs,
          targetFs: localFs,
          targetFsPath: '/remote',
          transferDirection: TransferDirection.LOCAL_TO_REMOTE,
          transferOption: {
            delete: true,
            perserveTargetMode: false,
          },
        },
        collect
      );
      expect(task.length).toEqual(6);
      expect(deleted.length).toEqual(3);
      expect(mapList(deleted, 'fspath').sort()).toEqual(
        ['/remote/$da', '/remote/$db', '/remote/c/$dc'].formatSep().sort()
      );
      expect(mapList(task, 'targetFsPath').sort()).toEqual(
        [
          '/remote/a',
          '/remote/b',
          '/remote/c/c-a',
          '/remote/c/c-b',
          '/remote/c/d/d-a',
          '/remote/c/d/d-b',
        ].formatSep().sort()
      );
    });

    test('sync --update', async () => {
      fillFs({
        local: {
          a: file('a', 1),
          b: file('b', 1),
          c: {
            'c-a': file('c-a', 1),
            'c-b': file('c-b', 1),
            d: {
              'd-a': file('d-a', 1),
              'd-b': file('d-b', 1),
            },
          },
        },
        remote: {
          a: file('$a'),
          $da: file('$da'),
          $db: {},
          c: {
            'c-a': file('$c-a'),
            $dc: file('$dc'),
            d: {
              'd-a': file('$d-a'),
            },
          },
        },
      });

      const task: TransferTask[] = [];
      const collect = (a: TransferTask) => task.push(a);
      const deleted = await sync(
        {
          srcFsPath: '/local',
          srcFs: localFs,
          targetFs: localFs,
          targetFsPath: '/remote',
          transferDirection: TransferDirection.LOCAL_TO_REMOTE,
          transferOption: {
            delete: true,
            perserveTargetMode: false,
          },
        },
        collect
      );
      expect(task.length).toEqual(6);
      expect(deleted.length).toEqual(3);
      expect(mapList(deleted, 'fspath').sort()).toEqual(
        ['/remote/$da', '/remote/$db', '/remote/c/$dc'].formatSep().sort()
      );
      expect(mapList(task, 'targetFsPath').sort()).toEqual(
        [
          '/remote/a',
          '/remote/b',
          '/remote/c/c-a',
          '/remote/c/c-b',
          '/remote/c/d/d-a',
          '/remote/c/d/d-b',
        ].formatSep().sort()
      );
    });

    test.skip('sync --update with time offset', async () => {
      const remoteFs = createRemoteFs({ remoteTimeOffsetInHours: 6 });
      fillFs({
        local: {
          a: file('a', 1),
        },
        remote: {
          a: file('$a'),
        },
      });
      const task: TransferTask[] = [];
      const collect = (a: TransferTask) => task.push(a);
      let deleted;
      const runSync = async () => {
        deleted = await sync(
          {
            srcFsPath: '/local',
            srcFs: localFs,
            targetFs: remoteFs,
            targetFsPath: '/remote',
            transferDirection: TransferDirection.LOCAL_TO_REMOTE,
            transferOption: {
              skipCreate: true,
              delete: false,
              perserveTargetMode: false,
            },
          },
          collect
        );
        await runTasks(task);
      };
      await runSync();
      expect(task.length).toEqual(1);
      expect(deleted.length).toEqual(0);
      expect(mapList(task, 'targetFsPath').sort()).toEqual(
        ['/remote/a'].formatSep().sort()
      );
      task.length = 0;
      deleted.length = 0;
      await runSync();
      expect(task.length).toEqual(0);
      expect(deleted.length).toEqual(0);
    });

    test('sync --skipDelete', async () => {
      fillFs({
        local: {
          a: file('a', 1),
          b: file('b', 1),
          c: {
            'c-a': file('c-a', 1),
            'c-b': file('c-b', 1),
            d: {
              'd-a': file('d-a', 1),
              'd-b': file('d-b', 1),
            },
          },
        },
        remote: {
          a: file('$a'),
          c: {
            'c-a': file('$c-a'),
            d: {
              'd-a': file('$d-a'),
            },
          },
        },
      });

      const task: TransferTask[] = [];
      const collect = (a: TransferTask) => task.push(a);
      const deleted = await sync(
        {
          srcFsPath: '/local',
          srcFs: localFs,
          targetFs: localFs,
          targetFsPath: '/remote',
          transferDirection: TransferDirection.LOCAL_TO_REMOTE,
          transferOption: {
            skipCreate: true,
            perserveTargetMode: false,
          },
        },
        collect
      );
      expect(task.length).toEqual(3);
      expect(deleted.length).toEqual(0);
      expect(mapList(task, 'targetFsPath').sort()).toEqual(
        ['/remote/a', '/remote/c/c-a', '/remote/c/d/d-a'].formatSep().sort()
      );
    });

    test('sync --update', async () => {
      fillFs({
        local: {
          a: file('a', 1),
          b: file('b', 1),
          c: {
            'c-a': file('c-a', 1),
            'c-b': file('c-b', 1),
            d: {
              'd-a': file('d-a', 1),
              'd-b': file('d-b', 1),
            },
          },
        },
        remote: {
          a: file('$a', 2),
          c: {
            'c-a': file('$c-a', 1),
            d: {
              'd-a': file('$d-a'),
            },
          },
        },
      });

      const task: TransferTask[] = [];
      const collect = (a: TransferTask) => task.push(a);
      const deleted = await sync(
        {
          srcFsPath: '/local',
          srcFs: localFs,
          targetFs: localFs,
          targetFsPath: '/remote',
          transferDirection: TransferDirection.LOCAL_TO_REMOTE,
          transferOption: {
            update: true,
            perserveTargetMode: false,
          },
        },
        collect
      );
      expect(task.length).toEqual(4);
      expect(deleted.length).toEqual(0);
      expect(mapList(task, 'targetFsPath').sort()).toEqual(
        [
          '/remote/b',
          '/remote/c/c-b',
          '/remote/c/d/d-a',
          '/remote/c/d/d-b',
        ].formatSep().sort()
      );
    });

    test('sync both direction"', async () => {
      fillFs({
        local: {
          a: file('a', 1),
          b: file('b', 1),
          c: {
            'c-a': file('c-a', 1),
            'c-b': file('c-b', 1),
            'c-c': file('c-c', 1),
            d: {
              'd-a': file('d-a', 1),
              'd-b': file('d-b', 1),
            },
          },
        },
        remote: {
          a: file('$a'),
          b: file('$b', 2),
          c: {
            'c-a': file('$c-a'),
            'c-b': file('$c-b', 2),
            d: {
              'd-a': file('$d-a'),
              'd-b': file('$d-b', 2),
              'd-c': file('$d-c'),
            },
          },
        },
      });

      const task: TransferTask[] = [];
      const collect = (a: TransferTask) => task.push(a);
      const deleted = await sync(
        {
          srcFsPath: '/local',
          srcFs: localFs,
          targetFs: localFs,
          targetFsPath: '/remote',
          transferDirection: TransferDirection.LOCAL_TO_REMOTE,
          transferOption: {
            bothDiretions: true,
            perserveTargetMode: false,
          },
        },
        collect
      );
      expect(task.length).toEqual(8);
      expect(deleted.length).toEqual(0);
      expect(mapList(task, 'targetFsPath').sort()).toEqual(
        [
          '/remote/a',
          '/local/b',
          '/remote/c/c-a',
          '/local/c/c-b',
          '/remote/c/c-c',
          '/remote/c/d/d-a',
          '/local/c/d/d-b',
          '/local/c/d/d-c',
        ].formatSep().sort()
      );
    });

    test('sync both direction --skipCreate"', async () => {
      fillFs({
        local: {
          a: file('a', 1),
          b: file('b', 1),
          c: {
            'c-a': file('c-a', 1),
            'c-b': file('c-b', 1),
            'c-c': file('c-c', 1),
            d: {
              'd-a': file('d-a', 1),
              'd-b': file('d-b', 1),
            },
          },
        },
        remote: {
          a: file('$a'),
          b: file('$b', 2),
          c: {
            'c-a': file('$c-a'),
            'c-b': file('$c-b', 2),
            d: {
              'd-a': file('$d-a'),
              'd-b': file('$d-b', 2),
              'd-c': file('$d-c'),
            },
          },
        },
      });

      const task: TransferTask[] = [];
      const collect = (a: TransferTask) => task.push(a);
      const deleted = await sync(
        {
          srcFsPath: '/local',
          srcFs: localFs,
          targetFs: localFs,
          targetFsPath: '/remote',
          transferDirection: TransferDirection.LOCAL_TO_REMOTE,
          transferOption: {
            skipCreate: true,
            bothDiretions: true,
            perserveTargetMode: false,
          },
        },
        collect
      );
      expect(task.length).toEqual(6);
      expect(deleted.length).toEqual(0);
      expect(mapList(task, 'targetFsPath').sort()).toEqual(
        [
          '/remote/a',
          '/local/b',
          '/remote/c/c-a',
          '/local/c/c-b',
          '/remote/c/d/d-a',
          '/local/c/d/d-b',
        ].formatSep().sort()
      );
    });
  });

  describe('preview sync', () => {
    afterEach(() => {
      vol.reset();
    });

    const tree = () => ({
      local: {
        a: file('a', 1),
        b: file('b', 1),
        n: {
          x: file('x', 1),
          deep: { y: file('y', 1) },
        },
      },
      remote: {
        a: file('$a'),
        $da: file('$da'),
        $db: { z: file('$z') },
      },
    });

    const config = (transferOption = {}) => ({
      srcFsPath: '/local',
      srcFs: localFs,
      targetFs: localFs,
      targetFsPath: '/remote',
      transferDirection: TransferDirection.LOCAL_TO_REMOTE,
      transferOption: {
        delete: true,
        perserveTargetMode: false,
        ...transferOption,
      },
    });

    test('planSync touches neither filesystem', async () => {
      fillFs(tree());
      const before = vol.toJSON();
      const plan = await planSync(config() as any);
      expect(vol.toJSON()).toEqual(before);
      expect(fs.existsSync('/remote/n')).toBe(false);

      const actions = plan.transfers
        .map(t => `${t.syncAction} ${t.targetFsPath}`)
        .sort();
      expect(actions).toEqual(
        [
          'update /remote/a',
          'create /remote/b',
          'create /remote/n/x',
          'create /remote/n/deep/y',
        ]
          .map(a => a.replace(/\//g, path.sep))
          .sort()
      );
      expect(mapList(plan.deletions, 'fspath').sort()).toEqual(
        ['/remote/$da', '/remote/$db'].formatSep().sort()
      );
    });

    test('planSync matches the transfers of a direct sync', async () => {
      fillFs(tree());
      const plan = await planSync(config() as any);
      const task: TransferTask[] = [];
      await sync(config() as any, t => task.push(t));
      expect(mapList(plan.transfers, 'targetFsPath').sort()).toEqual(
        mapList(task, 'targetFsPath').sort()
      );
    });

    test('planSync labels reverse transfers in both directions', async () => {
      fillFs({
        local: { a: file('a') },
        remote: { a: file('$a', 5), r: file('r') },
      });
      const plan = await planSync(config({ delete: false, bothDiretions: true }) as any);
      const byTarget = plan.transfers.map(t => [t.targetFsPath, t.transferType, t.syncAction]);
      expect(byTarget.sort()).toEqual(
        [
          ['/local/a'.replace(/\//g, path.sep), TransferDirection.REMOTE_TO_LOCAL, 'update'],
          ['/local/r'.replace(/\//g, path.sep), TransferDirection.REMOTE_TO_LOCAL, 'create'],
        ].sort()
      );
    });

    test('executeSyncPlan creates new empty folders like a direct sync', async () => {
      fillFs({
        local: { a: file('a'), empty: {}, n: { inner: {} } },
        remote: { a: file('a') },
      });
      const cfg = config({ delete: false }) as any;
      const plan = await planSync(cfg);
      expect(plan.transfers).toHaveLength(0);
      expect(mapList(plan.folders, 'fsPath').sort()).toEqual(
        ['/remote/empty', '/remote/n/inner'].formatSep().sort()
      );

      await executeSyncPlan(plan, () => true, cfg, () => undefined);
      expect(fs.existsSync('/remote/empty')).toBe(true);
      expect(fs.existsSync('/remote/n/inner')).toBe(true);
    });

    test('executeSyncPlan skips unselected empty folders', async () => {
      fillFs({ local: { empty: {} }, remote: {} });
      const cfg = config({ delete: false }) as any;
      const plan = await planSync(cfg);
      await executeSyncPlan(plan, () => false, cfg, () => undefined);
      expect(fs.existsSync('/remote/empty')).toBe(false);
    });

    describe('unsaved editors', () => {
      const openDirty = (fileName: string, content: string) => {
        const doc = {
          fileName,
          isClosed: false,
          isDirty: true,
          save: jest.fn(async () => {
            fs.writeFileSync(fileName, content);
            return true;
          }),
        };
        jest.spyOn(host, 'getOpenTextDocuments').mockReturnValue([doc] as any);
        return doc;
      };

      afterEach(() => {
        jest.restoreAllMocks();
      });

      test('executeSyncPlan saves a selected upload before it runs', async () => {
        fillFs({ local: { b: file('b') }, remote: {} });
        const doc = openDirty(path.normalize('/local/b'), 'edited');
        const cfg = config({ delete: false }) as any;
        const plan = await planSync(cfg);
        expect(doc.save).not.toHaveBeenCalled();

        const task: TransferTask[] = [];
        await executeSyncPlan(plan, () => true, cfg, t => task.push(t));
        expect(doc.save).toHaveBeenCalledTimes(1);
        for (const t of task) {
          await t.run().catch(() => undefined);
        }
        expect(fs.readFileSync('/remote/b', 'utf8')).toEqual('edited');
      });

      test('executeSyncPlan does not save an unselected upload', async () => {
        fillFs({ local: { b: file('b') }, remote: {} });
        const doc = openDirty(path.normalize('/local/b'), 'edited');
        const cfg = config({ delete: false }) as any;
        const plan = await planSync(cfg);
        await executeSyncPlan(plan, () => false, cfg, () => undefined);
        expect(doc.save).not.toHaveBeenCalled();
      });
    });

    test('executeSyncPlan applies only the selected items', async () => {
      fillFs(tree());
      const cfg = config() as any;
      const plan = await planSync(cfg);
      const skipped = new Set([
        syncPlanKey({
          kind: 'transfer',
          task: plan.transfers.find(t => t.targetFsPath.endsWith('b'))!,
        }),
        syncPlanKey({
          kind: 'delete',
          entry: plan.deletions.find(e => e.fspath.endsWith('$da'))!,
        }),
      ]);

      const task: TransferTask[] = [];
      await executeSyncPlan(plan, key => !skipped.has(key), cfg, t => task.push(t));
      for (const t of task) {
        // memfs throws EBADF on descriptor close after the upload has completed
        await t.run().catch(() => undefined);
      }

      expect(fs.readFileSync('/remote/a', 'utf8')).toEqual('a');
      expect(fs.readFileSync('/remote/n/deep/y', 'utf8')).toEqual('y');
      expect(fs.existsSync('/remote/b')).toBe(false);
      expect(fs.existsSync('/remote/$da')).toBe(true);
      expect(fs.existsSync('/remote/$db')).toBe(false);
    });
  });
});
