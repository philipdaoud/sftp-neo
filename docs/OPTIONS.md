# Complete `sftp.json` option reference

This page lists the intentional `sftp.json` configuration options supported by
the current SFTP Neo implementation.

> Verified against SFTP Neo 3.4.0 at commit `d9c210f`.

The example uses **JSONC** so each option can have an inline comment. **It is
documentation, not a file to copy unchanged into `.vscode/sftp.json`: standard
JSON does not allow `//` comments.**

Values match the effective runtime defaults. When the true default is omission
or `undefined`, the example uses a valid, behavior-equivalent stand-in such as
`null`, `""`, `0`, `false`, `{}`, or `[]`. Required values with no default use
clearly labelled placeholders.

The root can be this single configuration object or an array of configuration
objects. This is a reference rather than a recommended starting configuration:
copy only the options needed by your setup.

```jsonc
{
  "name": "My Server",                      // Display name. Required by the schema; no runtime default.
  "context": ".",                           // Local directory. Default: workspace root.
  "protocol": "sftp",                       // "sftp", "ftp", or runtime-only "local". Default: "sftp".

  "host": "localhost",                      // Server hostname. Required; no runtime default.
  "port": 22,                               // SSH config value or SFTP fallback 22; FTP fallback 21.
  "username": "username",                   // Required unless supplied by SSH config; no fallback.
  "password": null,                         // Password. Default: Secret Storage, then prompt.
  "remotePath": "./",                       // Remote directory. Runtime default: "./".
  "connectTimeout": 10000,                  // Connection timeout in ms. Default: 10000.
  "keepalive": 30000,                       // SSH config value or 30000 ms fallback; 0 disables it.

  "agent": null,                            // ssh-agent socket or "pageant". Default: none.
  "privateKeyPath": null,                   // Key path; may come from SSH config. Fallback: none.
  "passphrase": null,                       // Passphrase or true to prompt. Default: Secret Storage, then none.
  "interactiveAuth": false,                 // false, true, or answer array. Default: false.
  "sshConfigPath": "~/.ssh/config",         // OpenSSH config file. Effective default: "~/.ssh/config".
  "sshCustomParams": "",                    // Extra terminal SSH arguments. Runtime default: none.
  "algorithms": {},                         // SSH algorithm overrides. Default: ssh2 selections.
  "hop": [],                                // Subsequent SSH host(s) in the chain. Default: none.

  "uploadOnSave": false,                    // Upload on VS Code save. Default: false.
  "useTempFile": false,                     // Upload through a temporary file. Default: false.
  "openSsh": false,                         // Atomic OpenSSH rename; needs useTempFile. Default: false.
  "downloadOnOpen": false,                  // false, true, or "confirm". Runtime default: false.
  "concurrency": 4,                         // Maximum parallel file transfers. Default: 4.
  "filePerm": 0,                            // Permission digits read as octal, e.g. 644. Default: unset.
  "dirPerm": 0,                             // Permission digits read as octal, e.g. 755. Default: unset.
  "limitOpenFilesOnRemote": false,          // false, true (222), or number (minimum 127). Default: false.
  "remoteTimeOffsetInHours": 0,             // Remote time minus local time. Default: 0.

  "ignore": [],                             // User patterns. Default: []; **/.ftpquota stays internal.
  "ignoreFile": "",                         // Additional ignore file. Default: none.

  "watcher": {
    "files": false,                         // Glob for autoUpload/autoDelete; false disables them. Default: false.
    "autoUpload": false,                    // Upload external changes. Runtime default: false.
    "autoDelete": false,                    // Delete remote items deleted locally. Default: false.
    "autoRename": false                     // Rename remote items renamed in VS Code. Default: false.
  },

  "syncOption": {
    "delete": false,                        // When true, recursively delete destination-only items; ignored by bidirectional sync. Default: false.
    "skipCreate": false,                    // When true, do not create items missing on the receiving side. Default: false.
    "ignoreExisting": false,                // When true, skip shared items; shared directories are not traversed. Default: false.
    "update": false                         // When true, copy existing files only from a strictly newer sending side. Default: false.
  },

  "backup": {
    "enabled": false,                       // Back up files before overwriting. Default: false.
    "location": "remote",                   // "remote" or "local". Default: "remote".
    "folder": ".vscode/sftp-backup",        // Backup directory. Default: ".vscode/sftp-backup".
    "versions": 5,                          // Versions kept per file. Default: 5.
    "onDelete": false                       // Back up non-sync deletions. Default: false.
  },

  "remoteExplorer": {
    "filesExclude": [],                     // Extra patterns. Default: []; VCS metadata stays hidden.
    "order": 0,                             // Display order. Default: 0.
    "enableDragAndDrop": false              // Allow server-side drag and drop. Default: false.
  },

  "hooks": {
    "preUpload": "",                        // Command before upload. Default: none.
    "postUpload": "",                       // Command after upload. Default: none.
    "preDownload": "",                      // Command before download. Default: none.
    "postDownload": "",                     // Command after download. Default: none.
    "preSync": "",                          // Command before sync. Default: none.
    "postSync": ""                          // Command after sync. Default: none.
  },

  "remote": "",                             // VS Code remotefs.remote reference. Default: none.
  "defaultProfile": "",                     // Profile selected at startup. Default: none.
  "profiles": {}                            // Per-profile overrides. Default: none.
}
```

Sync detects changed existing files independently of `syncOption.update`: it
compares file size and modification time at whole-second precision, without
checking file contents.

The `backup`, `remoteExplorer`, `watcher`, and `syncOption` objects are
shallow-replaced, not deep-merged. In a partial object, omitted children remain
`undefined`. Boolean children generally behave as `false`, but
`backup.folder`, `backup.versions`, `watcher.files`, and `remoteExplorer.order`
do not reliably fall back. Profiles use the same shallow replacement; only
`ignore` is concatenated with the top-level value.

Write `filePerm` and `dirPerm` as JSON numbers such as `644` and `755`. Values
with a leading zero, such as `0755`, are not valid JSON.

## Protocol-specific options

### FTP and FTPS

FTP uses the common transfer, watcher, sync, backup, and Remote Explorer options
from the main reference. These are its connection-specific options:

```jsonc
{
  "protocol": "ftp",                        // Select FTP/FTPS. Default: "sftp".
  "port": 21,                               // FTP fallback port. Default: 21.
  "secure": false,                          // false, true, "control", or "implicit". Default: false.
  "secureOptions": {},                      // Options passed to Node.js TLS. Default: none.
  "passive": false,                         // Accepted by validation but currently has no effect.
  "concurrency": 1                          // Forced to 1 for FTP.
}
```

`secure: true` enables TLS. Because the current FTP client does not support
control-only TLS, `"control"` also enables full TLS. `"implicit"` selects
implicit FTPS. `secureOptions` is passed through to the underlying TLS client;
its available values and defaults therefore depend on Node.js/OpenSSL.

### Local

`"local"` is a runtime-only protocol that uses the machine's local filesystem
instead of opening a network connection. It is not currently advertised by the
bundled JSON schema, and validation still requires placeholder `host` and
`username` values:

```jsonc
{
  "name": "Local mirror",                   // Display name.
  "protocol": "local",                      // No SFTP or FTP connection is opened.
  "host": "local",                          // Required by validation but unused.
  "username": "local",                      // Required by validation but unused.
  "remotePath": "D:/mirror"                 // Local destination path; set it explicitly.
}
```

## SSH algorithm overrides

Leaving `algorithms` as `{}` uses the defaults selected by the bundled `ssh2`
library. Those lists depend partly on the Node.js/OpenSSL environment, so SFTP
Neo does not define fixed array values for them. These are all the available
override keys:

```jsonc
"algorithms": {
  "kex": ["ecdh-sha2-nistp256"],            // Key exchange. Default: ssh2 selection.
  "cipher": ["aes128-gcm@openssh.com"],     // Encryption cipher. Default: ssh2 selection.
  "serverHostKey": ["ssh-ed25519"],         // Server host-key format. Default: ssh2 selection.
  "hmac": ["hmac-sha2-256"],                // Message authentication. Default: ssh2 selection.
  "compress": ["none"]                      // Compression algorithms. Default: ssh2 selection.
}
```

The arrays above are override examples, not recommended replacements for the
library defaults. Each category also accepts an object that adjusts the default
list instead of replacing it:

```jsonc
"kex": {
  "append": [],                             // Add algorithms at the end. Default: [].
  "prepend": [],                            // Add algorithms at the start. Default: [].
  "remove": []                              // Remove exact algorithm names. Default: [].
}
```

## SSH connection chain

The top-level host is the first host in the connection chain. `hop` accepts the
next host as an object, or subsequent hosts as an array in connection order.
The final `hop` entry is the SFTP destination:

```jsonc
{
  "host": "bastion.example.com",            // First host: the bastion.
  "port": 22,                               // Top-level SSH config value or fallback 22.
  "username": "jumpuser",                   // Bastion login.
  "password": null,                         // Top level uses Secret Storage, then prompts.
  "hop": [
    {
      "host": "target.internal",            // Final entry: the SFTP destination.
      "port": 22,                           // Set explicitly for the final destination.
      "username": "appuser",                // Destination login.
      "password": null,                     // No hop Secret Storage lookup or password prompt.
      "connectTimeout": 10000,              // Explicit example; no extension hop default.
      "keepalive": 30000,                   // Effective fallback: 30000 ms.
      "agent": null,                        // ssh-agent socket. Default: none.
      "privateKeyPath": "/key",             // Read from the previous host in the chain.
      "passphrase": null,                   // No hop Secret Storage lookup. Default: none.
      "interactiveAuth": false,             // Effective default: false.
      "algorithms": {},                     // Default: selections made by ssh2.
      "limitOpenFilesOnRemote": false       // false, true (222), or a number. Default: false.
    }
  ]
}
```

Hop entries are not resolved through the top-level SSH config or Secret Storage.
Provide explicit authentication for each one. In particular, a final hop with
`password: null` and no usable key or agent may fail without prompting.

## Profiles

A profile can override connection and transfer options, including `watcher`.
Keep root metadata such as `name`, `context`, `defaultProfile`, and `profiles`
at the top level: some of it is consumed before profile merging. Object options
are replaced as a whole; only `ignore` is appended to the top-level list.

```jsonc
"defaultProfile": "dev",                    // No profile is selected by default.
"profiles": {
  "dev": {
    "host": "dev.example.com",              // Overrides the top-level host.
    "remotePath": "/var/www/dev",           // Overrides the top-level remote path.
    "watcher": {
      "files": "**/*",                      // Repeat it because watcher is replaced as a whole.
      "autoUpload": true,                   // Upload external changes for this profile.
      "autoDelete": false,                  // Effective default when omitted: false.
      "autoRename": false                   // Effective default when omitted: false.
    }
  }
}
```

## Safety notes

- Every `hooks.*` value is executed as a shell command in the workspace.
  A failing pre-hook prevents the transfer; a failing post-hook reports an
  error but cannot undo changes that already completed.
- `watcher.autoDelete` can delete remote content. `syncOption.delete` deletes
  destination-only content, which may be local or remote depending on the sync
  direction.
  `backup.onDelete` currently protects non-sync deletion paths only; it does not
  back up deletions performed by `syncOption.delete`.
- The runtime `ignore` default is `[]`. Apart from the internal
  `**/.ftpquota` exclusion, project files—including `.vscode/sftp.json`—are not
  excluded automatically. Add explicit ignore patterns for sensitive files.
