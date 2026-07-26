const settingStore = {
  sftp: {
    suppressPlaintextPasswordWarning: false,
  },
  'remotefs.remote': {},
};

jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn((section) => {
      const settings = settingStore[section] || {};
      return {
        get: jest.fn((key, defaultValue) => {
          const value = settings[key];
          return value === undefined ? defaultValue : value;
        }),
        update: jest.fn((key, value, global) => {
          settings[key] = value;
          return Promise.resolve();
        }),
      };
    }),
  },
  window: {
    showWarningMessage: jest.fn(() => Promise.resolve(undefined)),
    createStatusBarItem: jest.fn(() => ({
      show: jest.fn(),
      hide: jest.fn(),
      text: '',
      tooltip: '',
      command: undefined,
    })),
    createOutputChannel: jest.fn(() => ({
      show: jest.fn(),
      hide: jest.fn(),
      appendLine: jest.fn(),
      clear: jest.fn(),
    })),
  },
  StatusBarAlignment: { Left: 1 },
  commands: {
    executeCommand: jest.fn(() => Promise.resolve()),
  },
  Uri: {
    file: jest.fn((path) => ({ fsPath: path, scheme: 'file' })),
    parse: jest.fn((path) => ({ fsPath: path, scheme: 'file' })),
  },
}));

jest.mock('../../src/core/remoteFs', () => ({
  createRemoteIfNoneExist: jest.fn(() => Promise.resolve({})),
  removeRemoteFs: jest.fn(),
}));

jest.mock('../../src/modules/secrets', () => ({
  getCredential: jest.fn(() => Promise.resolve(undefined)),
}));

const vscode = require('vscode');
const FileService = require('../../src/core/fileService').default;
const { createRemoteIfNoneExist } = require('../../src/core/remoteFs');

function createConfig(overrides = {}) {
  return {
    name: 'test',
    context: '/tmp',
    host: 'example.com',
    port: 22,
    username: 'user',
    password: 'secret',
    protocol: 'sftp',
    remotePath: '/',
    uploadOnSave: false,
    useTempFile: false,
    openSsh: false,
    downloadOnOpen: false,
    syncOption: {
      delete: false,
      skipCreate: false,
      ignoreExisting: false,
      update: false,
    },
    backup: {
      enabled: false,
      folder: '',
      versions: 0,
    },
    ignore: [],
    ignoreFile: '',
    remoteExplorer: {
      order: 0,
    },
    remoteTimeOffsetInHours: 0,
    limitOpenFilesOnRemote: 0,
    passphrase: null,
    interactiveAuth: false,
    algorithms: {},
    concurrency: 1,
    sshConfigPath: undefined,
    hop: undefined,
    agent: null,
    privateKeyPath: null,
    secure: false,
    secureOptions: {},
    watcher: {
      files: false,
      autoUpload: false,
      autoDelete: false,
    },
    ...overrides,
  };
}

describe('FileService plaintext password warning', () => {
  beforeEach(() => {
    settingStore.sftp.suppressPlaintextPasswordWarning = false;
    vscode.window.showWarningMessage.mockClear();
    vscode.window.showWarningMessage.mockImplementation(() => Promise.resolve(undefined));
    createRemoteIfNoneExist.mockClear();
  });

  test('shows warning when a plaintext password is present', async () => {
    const service = new FileService('/tmp', '/tmp', createConfig());
    await service.getRemoteFileSystem(createConfig());

    expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(1);
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('plaintext password'),
      "Don't show again"
    );
  });

  test('does not show warning when sentinel value "prompt" is used', async () => {
    const service = new FileService('/tmp', '/tmp', createConfig({ password: 'prompt' }));
    await service.getRemoteFileSystem(createConfig({ password: 'prompt' }));

    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
  });

  test('does not show warning when sentinel value "secretStorage" is used', async () => {
    const service = new FileService('/tmp', '/tmp', createConfig({ password: 'secretStorage' }));
    await service.getRemoteFileSystem(createConfig({ password: 'secretStorage' }));

    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
  });

  test('does not show warning when suppressPlaintextPasswordWarning is true', async () => {
    settingStore.sftp.suppressPlaintextPasswordWarning = true;

    const service = new FileService('/tmp', '/tmp', createConfig());
    await service.getRemoteFileSystem(createConfig());

    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
  });

  test('persists suppression when "Don\'t show again" is clicked', async () => {
    vscode.window.showWarningMessage.mockImplementation(() =>
      Promise.resolve("Don't show again")
    );

    const service = new FileService('/tmp', '/tmp', createConfig());
    await service.getRemoteFileSystem(createConfig());

    expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(1);
    expect(settingStore.sftp.suppressPlaintextPasswordWarning).toBe(true);
  });
});

describe('FileService watcher profile override', () => {
  const app = require('../../src/app').default;

  // AppState invokes its observer on every change and holds only one, so the
  // tests need something registered before touching the profile.
  app.state.subscribe(() => {});

  function watcherConfigPassedTo(create) {
    return create.mock.calls[create.mock.calls.length - 1][1];
  }

  function serviceWithWatcherService(config) {
    const create = jest.fn();
    const dispose = jest.fn();
    const service = new FileService('/tmp', '/tmp', config);
    service.setWatcherService({ create, dispose });
    return { service, create, dispose };
  }

  beforeEach(() => {
    app.state.profile = null;
  });

  afterEach(() => {
    app.state.profile = null;
  });

  test('uses the root watcher config when no profile is active', () => {
    const { create } = serviceWithWatcherService(
      createConfig({ watcher: { files: '**/*', autoUpload: true, autoDelete: false } })
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(watcherConfigPassedTo(create)).toEqual({
      files: '**/*',
      autoUpload: true,
      autoDelete: false,
    });
  });

  test('a profile overrides the watcher config', () => {
    const { service, create } = serviceWithWatcherService(
      createConfig({
        watcher: { files: '**/*', autoUpload: true, autoDelete: false },
        profiles: {
          dev: { watcher: { files: '**/*', autoUpload: true, autoDelete: false } },
          prod: { watcher: { files: '**/*', autoUpload: false, autoDelete: false } },
        },
      })
    );

    app.state.profile = 'prod';
    service.reloadWatcher();

    expect(watcherConfigPassedTo(create).autoUpload).toBe(false);

    app.state.profile = 'dev';
    service.reloadWatcher();

    expect(watcherConfigPassedTo(create).autoUpload).toBe(true);
  });

  test('profiles that do not mention watcher inherit the root one', () => {
    const { service, create } = serviceWithWatcherService(
      createConfig({
        watcher: { files: '**/*', autoUpload: true, autoDelete: false },
        profiles: {
          prod: { host: 'prod.example.com' },
        },
      })
    );

    app.state.profile = 'prod';
    service.reloadWatcher();

    expect(watcherConfigPassedTo(create).autoUpload).toBe(true);
  });

  test('reloadWatcher disposes the previous watcher before rebuilding', () => {
    const { service, create, dispose } = serviceWithWatcherService(
      createConfig({ watcher: { files: '**/*', autoUpload: true, autoDelete: false } })
    );

    dispose.mockClear();
    service.reloadWatcher();

    expect(dispose).toHaveBeenCalledWith('/tmp');
    expect(create).toHaveBeenCalledTimes(2);
  });
});
