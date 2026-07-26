# `sftp.json` — Full configuration reference

Every option that can go into `.vscode/sftp.json`, with its type, default, and
behaviour.

`sftp.json` is **strict JSON** — comments (`//`, `/* */`) and trailing commas are
not supported. Unknown keys are passed through rather than rejected, so a typo
in an option name fails silently: check the spelling here if an option seems to
do nothing.

> Looking for VS Code *editor* settings (`sftp.debug`, `sftp.printDebugLog`, …)?
> Those live in `settings.json`, not here — see [Setting](./setting.md).

---

## Contents

- [File shape](#file-shape)
- [Option index](#option-index)
- [Identity & scope](#identity--scope) — `name`, `context`, `protocol`
- [Connection](#connection) — `host`, `port`, `username`, `password`, `remotePath`, `connectTimeout`, `keepalive`, `concurrency`, `limitOpenFilesOnRemote`
- [SFTP authentication](#sftp-authentication) — `privateKeyPath`, `passphrase`, `agent`, `interactiveAuth`, `sshConfigPath`, `algorithms`, `sshCustomParams`, `hop`
- [FTP / FTPS](#ftp--ftps) — `secure`, `secureOptions`, `passive`
- [Transfer behaviour](#transfer-behaviour) — `uploadOnSave`, `downloadOnOpen`, `useTempFile`, `openSsh`, `filePerm`, `dirPerm`, `remoteTimeOffsetInHours`
- [Ignoring files](#ignoring-files) — `ignore`, `ignoreFile`
- [`watcher`](#watcher) — `files`, `autoUpload`, `autoDelete`, `autoRename`
- [`syncOption`](#syncoption) — `delete`, `skipCreate`, `ignoreExisting`, `update`
- [`backup`](#backup) — `enabled`, `location`, `folder`, `versions`, `onDelete`
- [`remoteExplorer`](#remoteexplorer) — `filesExclude`, `order`, `enableDragAndDrop`
- [`hooks`](#hooks) — `preUpload`, `postUpload`, `preDownload`, `postDownload`, `preSync`, `postSync`
- [`profiles` & `defaultProfile`](#profiles--defaultprofile)
- [`remote`](#remote)

---

## File shape

### A single server

```json
{
  "name": "My Server",
  "host": "example.com",
  "protocol": "sftp",
  "port": 22,
  "username": "user",
  "remotePath": "/var/www/html"
}
```

### Several servers

The top level may also be an **array**. Each entry gets its own `context`, and
the entry whose `context` is the longest match for a file's path wins.

```json
[
  { "name": "Frontend", "context": "client/dist", "host": "cdn.example.com", "remotePath": "/static" },
  { "name": "Backend",  "context": "server",      "host": "api.example.com", "remotePath": "/var/api" }
]
```

### One server, several environments

Use [`profiles`](#profiles--defaultprofile) when the target differs only by a
few values and you want to switch between them from the command palette.

---

## Option index

| Option | Type | Default |
|---|---|---|
| [`name`](#name) | string | — |
| [`context`](#context) | string | workspace root |
| [`protocol`](#protocol) | `"sftp"` \| `"ftp"` \| `"local"` | `"sftp"` |
| [`host`](#host) | string | *required* |
| [`port`](#port) | number | `22` (sftp) / `21` (ftp) |
| [`username`](#username) | string | *required* |
| [`password`](#password) | string \| null | — (prompted) |
| [`remotePath`](#remotepath) | string | `"./"` |
| [`connectTimeout`](#connecttimeout) | number (ms) | `10000` |
| [`keepalive`](#keepalive) | number (ms) | `30000` |
| [`concurrency`](#concurrency) | number | `4` (forced to `1` on FTP) |
| [`limitOpenFilesOnRemote`](#limitopenfilesonremote) | boolean \| number | `false` |
| [`privateKeyPath`](#privatekeypath) | string | — |
| [`passphrase`](#passphrase) | string \| `true` \| null | — |
| [`agent`](#agent) | string | — |
| [`interactiveAuth`](#interactiveauth) | boolean \| string[] | `false` |
| [`sshConfigPath`](#sshconfigpath) | string | `~/.ssh/config` |
| [`algorithms`](#algorithms) | object | ssh2 defaults |
| [`sshCustomParams`](#sshcustomparams) | string | — |
| [`hop`](#hop) | object \| object[] | — |
| [`secure`](#secure) | boolean \| `"control"` \| `"implicit"` | `false` |
| [`secureOptions`](#secureoptions) | object | — |
| [`passive`](#passive) | boolean | `false` |
| [`uploadOnSave`](#uploadonsave) | boolean | `false` |
| [`downloadOnOpen`](#downloadonopen) | boolean \| `"confirm"` | `false` |
| [`useTempFile`](#usetempfile) | boolean | `false` |
| [`openSsh`](#openssh) | boolean | `false` |
| [`filePerm`](#fileperm) | number (octal) | — |
| [`dirPerm`](#dirperm) | number (octal) | — |
| [`remoteTimeOffsetInHours`](#remotetimeoffsetinhours) | number | `0` |
| [`ignore`](#ignore) | string[] | `[]` |
| [`ignoreFile`](#ignorefile) | string | — |
| [`watcher`](#watcher) | object | — |
| [`syncOption`](#syncoption) | object | — |
| [`backup`](#backup) | object | disabled |
| [`remoteExplorer`](#remoteexplorer) | object | — |
| [`hooks`](#hooks) | object | — |
| [`profiles`](#profiles--defaultprofile) | object | — |
| [`defaultProfile`](#defaultprofile) | string | — |
| [`remote`](#remote) | string | — |

---

## Identity & scope

### `name`

*string* — A label for this configuration. Shown in the Remote Explorer, in the
status bar, and anywhere you're asked to pick a server.

Optional, but give every entry a `name` as soon as you have more than one.

### `context`

*string* — A path **relative to the workspace root**. Only files under this path
belong to this configuration, and they map onto [`remotePath`](#remotepath).

**Default**: the workspace root.

```json
{ "context": "client/dist", "remotePath": "/static" }
```

With the above, `client/dist/app.js` uploads to `/static/app.js`.

When several configurations are present, the one with the **longest matching
`context`** handles a given file.

### `protocol`

*string* — `"sftp"`, `"ftp"`, or `"local"`.

**Default**: `"sftp"`

`"local"` treats the "remote" side as a path on your own machine, which is
useful for mirroring to a mounted share or another folder.

Choosing `"ftp"` forces [`concurrency`](#concurrency) to `1`.

---

## Connection

### `host`

*string* — Hostname or IP address of the server. **Required.**

### `port`

*number* — Port number.

**Default**: `22` when `protocol` is `sftp`, `21` when it is `ftp`.

### `username`

*string* — Username for authentication. **Required.**

### `password`

*string | null* — Password for password-based authentication.

**Prefer leaving this out.** Set it to `null` or omit it, and you'll be prompted
on first connect with the option to save the password to your **OS credential
store** (macOS Keychain, Windows Credential Manager, Linux libsecret) instead of
the file — which keeps `sftp.json` safe to commit.

A plaintext password here triggers a security warning; suppress it with the
`sftp.suppressPlaintextPasswordWarning` VS Code setting if you have a reason to
keep one.

### `remotePath`

*string* — The path on the remote host that [`context`](#context) maps onto.
An absolute path is strongly recommended.

**Default**: `"./"` (the login directory — usually the user's home)

### `connectTimeout`

*number (milliseconds)* — How long to wait for the connection to be established
before giving up.

**Default**: `10000`

When [`interactiveAuth`](#interactiveauth) is on, the ready-timeout is raised to
at least 60000 ms so there is time to type a code.

### `keepalive`

*number (milliseconds)* — How often to send a keepalive packet (SFTP) or a
`NOOP` command (FTP) to stop the server closing an idle connection.

**Default**: `30000`

Lower it if your server drops idle connections aggressively; set it to `0` to
disable keepalives entirely.

### `concurrency`

*number* — Maximum number of files transferred simultaneously.

**Default**: `4` — and **forced to `1`** when `protocol` is `"ftp"`.

Concurrent transfers share one SSH session; their streams and SFTP requests are
multiplexed over a single connection and SFTP channel.

Suggested values:

- `4` — safe default for shared or restricted servers.
- `8` — good starting point for a modern dedicated OpenSSH server.
- `16` — high performance on fast, modern dedicated OpenSSH servers.

Higher values mean more open files and more outstanding SFTP requests, so raise
it gradually and test against your server.

### `limitOpenFilesOnRemote`

*boolean | number* — Cap the number of file descriptors opened on the remote
server. Set to `true` to use the built-in limit of `222`, or give a number to
choose your own (values below `127` are raised to `127`).

**Default**: `false`

Don't set this unless a server is actually rejecting transfers with an
out-of-descriptors error.

---

## SFTP authentication

Only used when `protocol` is `"sftp"`.

### `privateKeyPath`

*string* — Path to your private key. `~` is expanded.

```json
{ "privateKeyPath": "~/.ssh/id_ed25519" }
```

### `passphrase`

*string | true | null* — The passphrase for an encrypted private key.

Set it to `true` rather than a string to be **prompted** for the passphrase
instead of storing it in cleartext; as with [`password`](#password), you can
then save it to your OS credential store.

### `agent`

*string* — Path to the ssh-agent socket, for agent-based authentication.

- **macOS / Linux**: usually `"$SSH_AUTH_SOCK"`.
- **Windows**: `"pageant"` to use Pageant, or the path to a Cygwin UNIX socket.

Agent auth avoids putting a key path or passphrase in the config at all.

### `interactiveAuth`

*boolean | string[]* — Enable keyboard-interactive authentication. Set to `true`
to get a prompt for each challenge the server sends — this is how you use TOTP /
multi-factor codes. Or pass an array of predefined answers to have them sent
automatically without prompting.

**Default**: `false`

Requires the server to have keyboard-interactive authentication enabled.

### `sshConfigPath`

*string* — Path to an OpenSSH client config file whose values (host, user,
identity file, …) are used to fill in anything not set here.

**Default**: `~/.ssh/config`

### `algorithms`

*object* — Explicit overrides for the transport-layer algorithms negotiated on
connect. Use this to talk to an old server that doesn't support the modern
defaults, or to restrict a connection to a stricter set.

Each key is a list of algorithm names in preference order:

```json
{
  "algorithms": {
    "kex": [
      "ecdh-sha2-nistp256",
      "ecdh-sha2-nistp384",
      "ecdh-sha2-nistp521",
      "diffie-hellman-group-exchange-sha256"
    ],
    "cipher": [
      "aes128-gcm@openssh.com",
      "aes256-gcm@openssh.com",
      "aes128-ctr",
      "aes192-ctr",
      "aes256-ctr"
    ],
    "serverHostKey": [
      "ssh-ed25519",
      "rsa-sha2-512",
      "rsa-sha2-256",
      "ecdsa-sha2-nistp256"
    ],
    "hmac": ["hmac-sha2-256", "hmac-sha2-512"]
  }
}
```

**Default**: the underlying ssh2 library's defaults. Only set the sub-keys you
actually need to change.

### `sshCustomParams`

*string* — Extra parameters appended to the SSH command run by
**SFTP: Open SSH in Terminal**. Supports `${remotePath}` interpolation.

```json
{ "sshCustomParams": "\"cd \\\"${remotePath}\\\"; exec \\$SHELL -l\"" }
```

### `hop`

*object | object[]* — Reach a server through one or more bastion / jump hosts.
Each hop takes the same connection and auth options as the top level.

The top-level `host`/`username` describe the **first** machine you connect to;
`hop` describes where to go from there.

```json
{
  "name": "Target",
  "host": "bastion.example.com",
  "username": "jumpuser",
  "privateKeyPath": "~/.ssh/id_rsa",
  "hop": {
    "host": "target.internal",
    "username": "appuser",
    "privateKeyPath": "~/.ssh/id_rsa"
  }
}
```

Pass an **array** to chain several hops, in order:

```json
{
  "host": "bastion1.example.com",
  "username": "jumpuser",
  "hop": [
    { "host": "bastion2.internal", "username": "jumpuser" },
    { "host": "target.internal",   "username": "appuser"  }
  ]
}
```

---

## FTP / FTPS

Only used when `protocol` is `"ftp"`.

### `secure`

*boolean | `"control"` | `"implicit"`* — Enable FTPS.

- `true` — encrypt both the control and data connections.
- `"control"` — encrypt the control connection only.
- `"implicit"` — implicitly encrypted control connection. Deprecated in modern
  use, and usually on port 990.

**Default**: `false`

### `secureOptions`

*object* — Additional options passed straight to Node's `tls.connect()`. See the
[TLS connect options](https://nodejs.org/api/tls.html#tls_tls_connect_options_callback).

Most commonly used to accept a self-signed certificate:

```json
{ "secure": true, "secureOptions": { "rejectUnauthorized": false } }
```

### `passive`

*boolean* — Use passive mode for data connections.

**Default**: `false`

---

## Transfer behaviour

### `uploadOnSave`

*boolean* — Upload a file every time you save it in VS Code.

**Default**: `false`

Safe to combine with [`watcher.autoUpload`](#watcherautoupload) — a save is
claimed before the file is written, so a Ctrl+S uploads once, not twice.

### `downloadOnOpen`

*boolean | `"confirm"`* — Download the remote copy whenever you open a file.

- `false` — never.
- `true` — always, silently.
- `"confirm"` — ask first each time.

**Default**: `false`

### `useTempFile`

*boolean* — Upload to a temporary file and rename it into place, so a visitor
never sees a half-written file.

**Default**: `false`

### `openSsh`

*boolean* — Use an atomic rename for the temp-file upload. Only supported by
OpenSSH servers, and requires [`useTempFile`](#usetempfile) to also be `true`.

**Default**: `false`

### `filePerm`

*number (octal)* — Permissions to set on newly uploaded **files**.

```json
{ "filePerm": 644 }
```

**Default**: unset — the mode of the source file is preserved (SFTP only).

### `dirPerm`

*number (octal)* — Permissions to set on newly created **directories**.

```json
{ "dirPerm": 755 }
```

**Default**: unset — the mode of the source directory is preserved (SFTP only).

Setting either `filePerm` or `dirPerm` turns off mode preservation for that
kind of entry.

### `remoteTimeOffsetInHours`

*number* — Hours of difference between your machine and the server
(remote minus local). Used when comparing timestamps to decide what is newer.

**Default**: `0`

---

## Ignoring files

### `ignore`

*string[]* — Glob patterns that are never transferred. Same semantics as
`.gitignore`; paths are relative to this configuration's [`context`](#context).

**Default**: `[]`

```json
{ "ignore": [".vscode", ".git", ".DS_Store", "node_modules"] }
```

### `ignoreFile`

*string* — Path to a file containing ignore patterns, in `.gitignore` format.
Either absolute, or relative to the workspace root.

```json
{ "ignoreFile": ".gitignore" }
```

Combines with [`ignore`](#ignore) rather than replacing it.

---

## `watcher`

*object* — React to file changes made **outside** the VS Code editor: by a build
step, a formatter, an AI agent, or another program.

```json
{
  "watcher": {
    "files": "**/*",
    "autoUpload": true,
    "autoDelete": false,
    "autoRename": false
  }
}
```

### `watcher.files`

*string | false | null* — Glob pattern of files to watch. `false` or `null`
disables the watcher.

### `watcher.autoUpload`

*boolean* — Upload a watched file when it changes.

**Default**: `true` (when `watcher` is configured)

Safe to combine with [`uploadOnSave`](#uploadonsave). A save inside VS Code is
claimed before the file is written, so the watcher skips it and only
`uploadOnSave` uploads — one upload per Ctrl+S, not two. Writes from outside the
editor never go through that path, so the watcher still picks them up.

#### Overriding the watcher per profile

`watcher` can be set inside a profile, so external changes upload automatically
on one environment and not another:

```json
{
  "watcher": { "files": "**/*", "autoUpload": false },
  "profiles": {
    "dev":  { "host": "dev.example.com",  "watcher": { "files": "**/*", "autoUpload": true } },
    "prod": { "host": "prod.example.com", "watcher": { "files": "**/*", "autoUpload": false } }
  }
}
```

Profiles replace object options wholesale rather than merging them key by key,
so repeat `files` in each profile rather than setting `autoUpload` alone. A
profile that doesn't mention `watcher` inherits the top-level one.

Switching with **SFTP: Set Profile** rebuilds the watcher straight away; no
window reload is needed.

### `watcher.autoDelete`

*boolean* — Delete the remote file or folder when the local one is deleted.

**Default**: `false`

```json
{ "watcher": { "files": "**/*", "autoUpload": true, "autoDelete": true } }
```

> **Warning**: this deletes on the server, and it is driven by local filesystem
> events. Switching Git branches, or an `ignore` pattern that is wider than you
> expect, can remove remote content you meant to keep. Folder deletes are
> recursive. Enable [`backup.onDelete`](#backupondelete) to keep a restorable
> copy of everything a delete removes.

Renames and moves are not covered by this option. The watcher sees them as a
delete plus a create, so with `autoDelete` on, the old remote file is removed and
the new one re-uploaded rather than renamed in place. Enable
[`watcher.autoRename`](#watcherautorename) to rename on the server instead, or
use **SFTP: Rename Remote** in the Remote Explorer for a one-off.

### `watcher.autoRename`

*boolean* — Rename or move on the server when you rename or move a file or
folder inside VS Code, instead of re-uploading it.

**Default**: `false`

With it on, renaming a folder costs a **single** server-side request no matter
how many files it holds, and no file contents cross the network:

```json
{ "watcher": { "files": "**/*", "autoUpload": true, "autoRename": true } }
```

Without it, a rename is seen as a delete plus a create: the whole folder is
re-uploaded under its new name and the old remote folder is left behind.

Notes and limits:

- **Only covers renames made through VS Code** — the explorer, `F2`, drag to
  move, and refactorings. A `mv` in the terminal or a `git mv` still looks like
  a delete plus a create to the extension.
- While a rename is in flight the watcher ignores the paths involved, so
  `autoUpload`/`autoDelete` don't undo it.
- Moves that cross into a different configuration are skipped and fall back to
  the normal upload path.
- If the remote copy doesn't exist yet (the file was never uploaded), the rename
  fails and, when `autoUpload` is on, the new path is uploaded instead.
- The old remote path is left alone if the rename fails; check the `sftp` output
  channel.

---

## `syncOption`

*object* — Defaults for the **Sync Local → Remote** / **Sync Remote → Local**
commands.

```json
{
  "syncOption": {
    "delete": true,
    "skipCreate": false,
    "ignoreExisting": false,
    "update": false
  }
}
```

### `syncOption.delete`

*boolean* — Delete files at the destination that don't exist at the source.

> **Warning**: this is the destructive part of a sync. With it on, syncing a
> partially-populated local folder to the server removes everything on the
> server that isn't in it.

### `syncOption.skipCreate`

*boolean* — Never create new files at the destination; only update ones that
already exist there.

### `syncOption.ignoreExisting`

*boolean* — Never update files that already exist at the destination; only
create missing ones.

### `syncOption.update`

*boolean* — Only overwrite when the source copy is newer than the destination
copy.

---

## `backup`

*object* — Keep copies of remote files before they are overwritten by an upload
or a sync-to-remote, so you can roll back a bad deploy.

**Default**:

```json
{
  "backup": {
    "enabled": false,
    "location": "remote",
    "folder": ".vscode/sftp-backup",
    "versions": 5,
    "onDelete": false
  }
}
```

Browse and restore from the **Backups** panel in the SFTP view.

### `backup.enabled`

*boolean* — Turn backups on.

**Default**: `false`

### `backup.location`

*`"remote"` | `"local"`* — Where the copies are kept.

- `"remote"` — on the server, under [`remotePath`](#remotepath). The copy is made
  server-side where possible, so it's fast and uses no bandwidth.
- `"local"` — in your workspace. The remote directory structure is preserved
  inside the backup folder.

**Default**: `"remote"`

### `backup.folder`

*string* — Folder the copies go in. Resolved relative to `remotePath` when
`location` is `"remote"`, or relative to the workspace root when it is
`"local"`. Automatically excluded from sync and from the Remote Explorer.

**Default**: `".vscode/sftp-backup"`

### `backup.versions`

*number* — How many past versions to keep per file. Older ones are pruned.
Setting it to `0` disables backups even when `enabled` is `true`.

**Default**: `5`

### `backup.onDelete`

*boolean* — Also back up files before they are **deleted** from the server, not
just before they are overwritten.

**Default**: `false`

Only takes effect when `backup.enabled` is `true` and `backup.versions` is
greater than `0`.

```json
{
  "backup": {
    "enabled": true,
    "location": "remote",
    "folder": ".vscode/sftp-backup",
    "versions": 5,
    "onDelete": true
  }
}
```

With it on, every delete route is covered: **SFTP: Delete Remote**,
[`watcher.autoDelete`](#watcherautodelete), and the deletions performed by
**SFTP: Upload Changed Files**.

- Deleting a **folder** backs up every file inside it first, recursively.
- If any backup fails, the delete is **aborted** and nothing is removed. The
  error names the file that could not be copied.
- Symlinks are skipped rather than copied, since a copy of the link target
  wouldn't restore as a link.
- The backup folder itself is never backed up, so deleting a folder that
  contains it won't recurse into old backups.
- Restore from the **Backups** panel, the same as for overwrite backups.

> **Performance**: backups copy file contents. With `location: "remote"` the
> data travels server → editor → server, so backing up a large folder before
> deleting it can take a long time and move a lot of data. This is the trade for
> being able to undo a delete.

---

## `remoteExplorer`

*object* — Controls the Remote Explorer tree.

```json
{
  "remoteExplorer": {
    "filesExclude": ["node_modules", ".git"],
    "order": 0,
    "enableDragAndDrop": false
  }
}
```

### `remoteExplorer.filesExclude`

*string[]* — Patterns for files and folders to hide from the tree. Display only;
this does not affect what gets transferred (use [`ignore`](#ignore) for that).

**Default**: `[]`

### `remoteExplorer.order`

*number* — Sort position of this configuration among the roots in the tree.
Lower numbers appear first.

**Default**: `0`

### `remoteExplorer.enableDragAndDrop`

*boolean* — Allow dragging files and folders inside the Remote Explorer to move
them on the server.

**Default**: `false`

Set per configuration, so you can turn it on for staging and leave it off for
production:

```json
{ "remoteExplorer": { "enableDragAndDrop": true } }
```

A move is a server-side rename: one request, no file contents transferred, no
matter how large the folder is.

- Drop onto a **folder** to move items into it. Dropping onto a **file** moves
  into the folder that file lives in.
- Moving a folder, or moving more than one item, asks for confirmation first.
  Moving a single file does not, since dragging it back undoes it.
- Dropping a folder into itself or into one of its own subfolders is refused.
- If you select a folder and something inside it, only the folder moves.
- Dropping onto empty space is refused, because the destination is ambiguous
  when several remotes are configured.
- Dragging **between different configurations** is not supported; the whole drop
  is refused rather than moving part of the selection.
- Dragging out of the Remote Explorer (to the file explorer or the editor) does
  nothing. Use **Download** from the context menu instead.

Existing files are not overwritten: if something already exists at the
destination the move is reported as an error and nothing is changed.

---

## `hooks`

*object* — Shell commands run around transfers. Each value is a single command
string.

```json
{
  "hooks": {
    "preUpload": "npm run build",
    "postUpload": "ssh deploy@example.com 'systemctl reload nginx'",
    "preDownload": "",
    "postDownload": "",
    "preSync": "",
    "postSync": ""
  }
}
```

| Hook | Runs |
|---|---|
| `preUpload` | before each upload |
| `postUpload` | after each upload |
| `preDownload` | before each download |
| `postDownload` | after each download |
| `preSync` | before a sync |
| `postSync` | after a sync |

How they run:

- The working directory is the **workspace root**.
- Each command has a **30-second timeout**.
- `stdout` and `stderr` go to the `sftp` output channel.
- A **failing `pre` hook aborts the transfer**; a failing hook of any kind shows
  an error message and stops the operation.

These environment variables are set for the command:

| Variable | Value |
|---|---|
| `SFTP_LOCAL_PATH` | absolute local path of the file |
| `SFTP_REMOTE_PATH` | absolute remote path of the file |
| `SFTP_HOST` | the configured `host` |
| `SFTP_PROTOCOL` | the configured `protocol` |

> `preUpload`/`postUpload` fire **per file**. With a multi-file upload the
> command runs once per file, so keep it cheap or drive it off `preSync`
> instead.

---

## `profiles` & `defaultProfile`

### `profiles`

*object* — Named variants of the configuration. Each key is a profile name, and
its value is a partial config whose keys override the top level.

```json
{
  "name": "My App",
  "username": "deploy",
  "remotePath": "/var/www/app",
  "privateKeyPath": "~/.ssh/id_rsa",
  "uploadOnSave": false,

  "profiles": {
    "dev": {
      "host": "dev.example.com",
      "uploadOnSave": true
    },
    "prod": {
      "host": "prod.example.com",
      "remotePath": "/var/www/app-live"
    }
  },
  "defaultProfile": "dev"
}
```

Switch with **SFTP: Set Profile** from the command palette.

**Merge semantics**: object-valued options are replaced **wholesale**, not
merged key by key. A profile that sets `watcher` must repeat every key of
`watcher` it wants; a profile that omits it inherits the top-level object
unchanged. The same applies to `backup`, `syncOption`, `remoteExplorer`, and
`hooks`.

Once `profiles` is present, a profile must be selected before any transfer will
run — set [`defaultProfile`](#defaultprofile) so there's always one active.

### `defaultProfile`

*string* — The profile selected when the workspace opens.

---

## `remote`

*string* — Name of an entry in the `remotefs.remote` **VS Code user setting**,
whose values are merged into this configuration. Use it to keep credentials in
your user settings, out of a `sftp.json` that gets committed.

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

Notes:

- The remote entry's `scheme` maps onto [`protocol`](#protocol).
- Its `rootPath` is ignored — set [`remotePath`](#remotepath) here instead.
- Values already set in `sftp.json` win; the remote entry only fills in what is
  missing.
- An unknown name is an error: `Can't not find remote "<name>"`.

---

## See also

- [Setting](./setting.md) — VS Code settings for the extension
- [Commands](./commands.md) — everything in the command palette
- [FAQ](../FAQ.md)
