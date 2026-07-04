import * as vscode from 'vscode';
import * as fse from 'fs-extra';
import * as path from 'path';
import { z } from 'zod';
import { CONFIG_PATH } from '../constants';
import { reportError } from '../helper';
import { showTextDocument } from '../host';

const nullableString = z.string().optional().nullable();

const configScheme = z.object({
  name: z.string().optional(),
  context: z.string().optional(),
  protocol: z.enum(['sftp', 'ftp', 'local']).optional(),

  host: z.string(),
  port: z.number().int().optional(),
  connectTimeout: z.number().int().optional(),
  username: z.string(),
  password: nullableString,

  agent: nullableString,
  privateKeyPath: nullableString,
  passphrase: z.union([z.string(), z.literal(true)]).optional().nullable(),
  interactiveAuth: z.union([z.boolean(), z.array(z.string())]).optional(),
  algorithms: z.any().optional(),
  sshConfigPath: z.string().optional(),
  sshCustomParams: z.string().optional(),

  secure: z.union([z.boolean(), z.literal('control'), z.literal('implicit')]).optional(),
  secureOptions: z.record(z.string(), z.any()).optional().nullable(),
  passive: z.boolean().optional(),

  remotePath: z.string(),
  uploadOnSave: z.boolean().optional(),
  useTempFile: z.boolean().optional(),
  openSsh: z.boolean().optional(),
  downloadOnOpen: z.union([z.boolean(), z.literal('confirm')]).optional(),

  ignore: z.array(z.string()).optional(),
  ignoreFile: z.string().optional(),
  watcher: z.object({
    files: z.union([z.string(), z.literal(false), z.null()]).optional(),
    autoUpload: z.boolean().optional(),
    autoDelete: z.boolean().optional(),
  }).optional(),
  concurrency: z.number().int().optional(),

  syncOption: z.object({
    delete: z.boolean().optional(),
    skipCreate: z.boolean().optional(),
    ignoreExisting: z.boolean().optional(),
    update: z.boolean().optional(),
  }).optional(),
  backup: z.object({
    enabled: z.boolean().optional(),
    location: z.enum(['local', 'remote']).optional(),
    folder: z.string().optional(),
    versions: z.number().int().min(0).optional(),
  }).optional(),
  remoteTimeOffsetInHours: z.number().optional(),

  remoteExplorer: z.object({
    filesExclude: z.array(z.string()).optional(),
    order: z.number().optional(),
  }).optional(),

  hooks: z.object({
    preUpload: z.string().optional(),
    postUpload: z.string().optional(),
    preDownload: z.string().optional(),
    postDownload: z.string().optional(),
    preSync: z.string().optional(),
    postSync: z.string().optional(),
  }).optional(),

  // Additional fields used in the codebase
  profiles: z.record(z.string(), z.any()).optional(),
  remote: z.string().optional(),
  limitOpenFilesOnRemote: z.union([z.boolean(), z.number()]).optional(),
  filePerm: z.number().optional(),
  dirPerm: z.number().optional(),
}).passthrough();

const defaultConfig = {
  // common
  // name: undefined,
  remotePath: './',
  uploadOnSave: false,
  useTempFile: false,
  openSsh: false,
  downloadOnOpen: false,
  ignore: [],
  // ignoreFile: undefined,
  // watcher: {
  //   files: false,
  //   autoUpload: false,
  //   autoDelete: false,
  // },
  concurrency: 4,
  // limitOpenFilesOnRemote: false

  protocol: 'sftp',

  // server common
  // host,
  // port,
  // username,
  // password,
  connectTimeout: 10 * 1000,

  // sftp
  // agent,
  // privateKeyPath,
  // passphrase,
  interactiveAuth: false,
  // algorithms,

  // ftp
  secure: false,
  // secureOptions,
  // passive: false,
  remoteTimeOffsetInHours: 0,

  remoteExplorer: {
    order: 0,
  },

  backup: {
    enabled: false,
    location: 'remote',
    folder: '.vscode/sftp-backup',
    versions: 5,
  },
};

function mergedDefault(config) {
  return {
    ...defaultConfig,
    ...config,
  };
}

function getConfigPath(basePath) {
  return path.join(basePath, CONFIG_PATH);
}

export function validateConfig(config) {
  const result = configScheme.safeParse(config);
  if (!result.success) {
    const messages = result.error.issues.map(
      issue => `${issue.path.join('.')}: ${issue.message}`
    );
    return new Error(messages.join(', '));
  }
  return null;
}

export function readConfigsFromFile(configPath): Promise<any[]> {
  return fse.readJson(configPath).then(config => {
    const configs = Array.isArray(config) ? config : [config];
    return configs.map(mergedDefault);
  });
}

export function tryLoadConfigs(workspace): Promise<any[]> {
  const configPath = getConfigPath(workspace);
  return fse.pathExists(configPath).then(
    exist => {
      if (exist) {
        return readConfigsFromFile(configPath);
      }
      return [];
    },
    _ => []
  );
}

// export function getConfig(activityPath: string) {
//   const config = configTrie.findPrefix(normalizePath(activityPath));
//   if (!config) {
//     throw new Error(`(${activityPath}) config file not found`);
//   }

//   return normalizeConfig(config);
// }

export function newConfig(basePath) {
  const configPath = getConfigPath(basePath);

  return fse
    .pathExists(configPath)
    .then(exist => {
      if (exist) {
        return showTextDocument(vscode.Uri.file(configPath));
      }

      return fse
        .outputJson(
          configPath,
          {
            name: 'My Server',
            host: 'localhost',
            protocol: 'sftp',
            port: 22,
            username: 'username',
            remotePath: '/',
            uploadOnSave: false,
            useTempFile: false,
            openSsh: false,
          },
          { spaces: 4 }
        )
        .then(() => showTextDocument(vscode.Uri.file(configPath)));
    })
    .catch(reportError);
}
