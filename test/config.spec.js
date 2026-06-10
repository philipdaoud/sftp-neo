const { validateConfig } = require('../src/modules/config');

describe("validation config", () => {
  test("default config", () => {
    const config = {
      host: 'host',
      port: 22,
      username: 'username',
      password: null,
      protocol: 'sftp',
      agent: null,
      privateKeyPath: null,
      passive: false,
      interactiveAuth: false,

      remotePath: '/',
      uploadOnSave: false,

      useTempFile: false,
      openSsh: false,

      syncMode: 'update',

      watcher: {
        files: false,
        autoUpload: false,
        autoDelete: false,
      },

      ignore: [
        '**/.vscode',
        '**/.git',
        '**/.DS_Store',
      ],
    };

    const error = validateConfig(config);
    expect(error).toBe(null);
  });

  test("partial config", () => {
    const config = {
      host: 'host',
      port: 22,
      username: 'username',
      protocol: 'sftp',

      remotePath: '/',

      syncMode: 'update',

      watcher: {},

      ignore: [
        '**/.vscode',
        '**/.git',
        '**/.DS_Store',
      ],
    };

    let error = validateConfig(config);
    expect(error).toBe(null);

    delete config.watcher;
    error = validateConfig(config);
    expect(error).toBe(null);
  });

  describe("key validation", () => {
    test("protocol must be one of ['sftp', 'ftp']", () => {
      const config = {
        host: 'host',
        port: 22,
        username: 'username',
        protocol: 'unknown',
        passive: false,
        interactiveAuth: false,

        remotePath: '/',
        uploadOnSave: false,

        useTempFile: false,
        openSsh: false,

        syncMode: 'update',

        watcher: {
          files: false,
          autoUpload: false,
          autoDelete: false,
        },

        ignore: [
          '**/.vscode',
          '**/.git',
          '**/.DS_Store',
        ],
      };

      const error = validateConfig(config);
      expect(error).not.toBe(null);
    });

    test("watcher files must be false or string", () => {
      const config = {
        host: 'host',
        port: 22,
        username: 'username',
        protocol: 'sftp',
        passive: false,
        interactiveAuth: false,

        remotePath: '/',
        uploadOnSave: false,

        useTempFile: false,
        openSsh: false,

        syncMode: 'update',

        watcher: {
          files: false,
          autoUpload: false,
          autoDelete: false,
        },

        ignore: [
          '**/.vscode',
          '**/.git',
          '**/.DS_Store',
        ],
      };

      let error = validateConfig(config);
      expect(error).toBe(null);

      config.watcher.files = '**/*.js';
      error = validateConfig(config);
      expect(error).toBe(null);

      config.watcher.files = null;
      error = validateConfig(config);
      expect(error).toBe(null);

      config.watcher.files = true;
      error = validateConfig(config);
      expect(error).not.toBe(null);

      delete config.watcher;
      error = validateConfig(config);
      expect(error).toBe(null);
    });

    test("ignore must be an array of string", () => {
      const config = {
        host: 'host',
        port: 22,
        username: 'username',
        protocol: 'sftp',
        passive: false,
        interactiveAuth: false,

        remotePath: '/',
        uploadOnSave: false,

        useTempFile: false,
        openSsh: false,

        syncMode: 'update',

        watcher: {
          files: false,
          autoUpload: false,
          autoDelete: false,
        },

        ignore: [
          1,
          '**/.git',
          '**/.DS_Store',
        ],
      };

      let error = validateConfig(config);
      expect(error).not.toBe(null);

      config.ignore = [];
      error = validateConfig(config);
      expect(error).toBe(null);
    });

    test("passphrase validation", () => {
      const config = {
        host: 'host',
        port: 22,
        username: 'username',
        protocol: 'sftp',
        passive: false,
        interactiveAuth: false,
        passphrase: 'true',

        remotePath: '/',
        uploadOnSave: false,

        useTempFile: false,
        openSsh: false,

        syncMode: 'update',

        watcher: {
          files: false,
          autoUpload: false,
          autoDelete: false,
        },

        ignore: [
          '**/.git',
          '**/.DS_Store',
        ],
      };

      let error = validateConfig(config);
      expect(error).toBe(null);

      config.passphrase = false;
      error = validateConfig(config);
      expect(error).not.toBe(null);
    });
  });
});
