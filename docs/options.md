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

**Contents**: [All options](#complete-sftpjson-option-reference) ·
[FTP and FTPS](#ftp-and-ftps) · [Local](#local) ·
[SSH algorithm overrides](#ssh-algorithm-overrides) ·
[SSH connection chain](#ssh-connection-chain) · [Profiles](#profiles) ·
[Option details](#option-details) · [Safety notes](#safety-notes)

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

## Option details

Options whose behaviour needs more than a comment line.

### `context` and multiple configurations

`context` is a path relative to the workspace root. Files under it belong to
this configuration and map onto `remotePath`:

```json
{ "context": "client/dist", "remotePath": "/static" }
```

`client/dist/app.js` uploads to `/static/app.js`.

When the root is an array, the configuration with the **longest matching
`context`** handles a given file.

### `password` and `passphrase`

Prefer omitting both, or setting them to `null`. You are then prompted on first
connect and can save the value to the OS credential store (macOS Keychain,
Windows Credential Manager, Linux libsecret) rather than to the file, which
keeps `sftp.json` safe to commit.

Setting `passphrase` to `true` forces the prompt for an encrypted key without
storing anything in the file.

A plaintext `password` triggers a security warning; suppress it with the
`sftp.suppressPlaintextPasswordWarning` VS Code setting.

Secret Storage and SSH config lookups apply to the **top-level host only** — see
[SSH connection chain](#ssh-connection-chain).

### `concurrency`

Concurrent transfers share one SSH session; their streams and SFTP requests are
multiplexed over a single connection and SFTP channel.

- `4` — safe default for shared or restricted servers.
- `8` — reasonable for a modern dedicated OpenSSH server.
- `16` — high throughput on fast, dedicated OpenSSH servers.

Higher values mean more open files and more outstanding SFTP requests. Raise it
gradually and test against your server. Forced to `1` for FTP.

### `uploadOnSave` with `watcher.autoUpload`

Safe to enable together. A save inside VS Code is claimed before the file is
written, so the watcher skips it and only `uploadOnSave` uploads — one upload
per Ctrl+S, not two. Writes from outside the editor never go through that path,
so the watcher still catches them.

### `watcher.autoDelete`

Deletes on the server, driven by local filesystem events. Switching Git
branches, or an `ignore` pattern that is wider than expected, can remove remote
content you meant to keep. Folder deletes are recursive.

Renames are not covered by this option: the watcher sees a rename as a delete
plus a create, so the old remote path is removed and the new one re-uploaded.
Use `watcher.autoRename` to rename in place instead.

### `watcher.autoRename`

Turns a rename or move made inside VS Code into a server-side rename. Renaming a
folder then costs a single request regardless of size, and no file contents
cross the network.

Limits:

- Covers only renames made **through VS Code** — the explorer, `F2`, drag to
  move, refactorings. A terminal `mv` or `git mv` still looks like a delete plus
  a create.
- While a rename is in flight the watcher ignores the paths involved, so
  `autoUpload`/`autoDelete` do not undo it.
- Moves crossing into a different configuration are skipped and fall back to the
  normal upload path.
- If the remote copy does not exist yet, the rename fails; with `autoUpload` on,
  the new path is uploaded instead.
- A failed rename leaves the old remote path alone. Check the `sftp` output
  channel.

### `backup.location`

- `"remote"` — copies live on the server under `remotePath`. Note that the copy
  travels server → editor → server, so backing up large files moves real data.
- `"local"` — copies live in the workspace, preserving the remote directory
  structure inside `backup.folder`.

`backup.folder` is resolved relative to `remotePath` for `"remote"` and to the
workspace root for `"local"`. It is automatically excluded from sync and the
Remote Explorer, and is never itself backed up.

### `backup.onDelete`

Requires `backup.enabled: true` and `backup.versions > 0`.

- Deleting a folder backs up every file inside it first, recursively.
- If any backup fails, the delete is **aborted** and nothing is removed. The
  error names the file that could not be copied.
- Symlinks are skipped rather than copied, since a copy of the link target would
  not restore as a link.
- Restore from the **Backups** panel.

Covers `SFTP: Delete Remote`, `watcher.autoDelete`, and the deletions performed
by `SFTP: Upload Changed Files`. It does **not** cover `syncOption.delete` — see
[Safety notes](#safety-notes).

### `remoteExplorer.enableDragAndDrop`

A move is a server-side rename: one request, no file contents transferred.

- Drop onto a **folder** to move items into it. Dropping onto a **file** moves
  into that file's folder.
- Moving a folder, or more than one item, asks for confirmation. Moving a single
  file does not, since dragging it back undoes it.
- Dropping a folder into itself or its own subfolder is refused.
- Selecting a folder and something inside it moves only the folder.
- Dropping onto empty space is refused: the destination is ambiguous when
  several remotes are configured.
- Dragging **between configurations** is refused outright rather than moving
  part of the selection.
- Dragging out of the Remote Explorer does nothing; use **Download**.

Existing files are never overwritten — the move is reported as an error and
nothing changes.

### `hooks`

Each value is a single shell command.

| Hook | Runs |
|---|---|
| `preUpload` / `postUpload` | before / after each upload |
| `preDownload` / `postDownload` | before / after each download |
| `preSync` / `postSync` | before / after a sync |

- Working directory is the **workspace root**.
- Each command has a **30-second timeout**.
- `stdout` and `stderr` go to the `sftp` output channel.
- A failing `pre` hook aborts the transfer. A failing `post` hook reports an
  error but cannot undo what already completed.

Environment variables available to the command:

| Variable | Value |
|---|---|
| `SFTP_LOCAL_PATH` | absolute local path of the file |
| `SFTP_REMOTE_PATH` | absolute remote path of the file |
| `SFTP_HOST` | the configured `host` |
| `SFTP_PROTOCOL` | the configured `protocol` |

Upload and download hooks fire **per file**, so a multi-file upload runs the
command once per file. Keep it cheap, or drive it from `preSync`/`postSync`.

### `remote`

Names an entry in the `remotefs.remote` **VS Code user setting**, whose values
fill in anything not set locally. Useful for keeping credentials out of a
committed `sftp.json`.

In `settings.json`:

```json
{
  "remotefs.remote": {
    "my-server": {
      "scheme": "sftp",
      "host": "example.com",
      "username": "user",
      "privateKeyPath": "~/.ssh/id_rsa"
    }
  }
}
```

In `.vscode/sftp.json`:

```json
{
  "remote": "my-server",
  "remotePath": "/var/www/html",
  "uploadOnSave": true
}
```

- The entry's `scheme` maps onto `protocol`; its `rootPath` is ignored.
- Values already set in `sftp.json` win — the entry only fills gaps.
- An unknown name raises `Can't not find remote "<name>"`.

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
