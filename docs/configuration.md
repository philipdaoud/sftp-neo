# Full configuration

## Sample configuration

```json
{
  "name": "My Server",
  "host": "localhost",
  "protocol": "sftp",
  "port": 22,
  "username": "username",
  "remotePath": "/",
  "uploadOnSave": false,
  "useTempFile": false,
  "openSsh": false,
  "concurrency": 4,
  "keepalive": 30000,
  "backup": {
    "enabled": false,
    "location": "remote",
    "folder": ".vscode/sftp-backup",
    "versions": 5
  }
}
```

## name
*string*: A string to identify your configuration.

## context
*string*: A path relative to the workspace root folder.
Use this when you want to map a subfolder to the `remotePath`.

**default**: The workspace root.

## protocol
*string*: `sftp` or `ftp`.

**default**: `sftp`

## host
*string*: Hostname or IP address of the server.

## port
*integer*: Port number of the server.

**default**: 22

## username
*string*: Username for authentication.

## password
*string*: The password for password-based user authentication (**note: this is stored as plain-text**).

## remotePath
*string*: The absolute path on the remote host.

**default**: `/`

## filePerm
*number*: Set octal file permissions for new files.

**default**: false

## dirPerm
*number*: Set octal directory permissions for new directories.

**default**: false

## uploadOnSave
*boolean*: Upload on every save operation of VSCode.

**default**: false

## useTempFile
*boolean*: Upload temp file on every save operation of VSCode to avoid breaking a webpage when a user acceses it while the file is still being uploaded (is incomplete).

**default**: false

## openSsh
*boolean*: Enable atomic file uploads (only supported by openSSH servers).
If set to true, the `useTempFile` option must also be set to true.

**default**: false

## downloadOnOpen
*boolean*: Download the file from the remote server whenever it is opened.

**default**: false

## syncOption
*object*: Configure the behavior of the `Sync` command.

**default**: `{}`

## syncOption.delete
*boolean*: Delete extraneous files from destination directories.

## syncOption.skipCreate
*boolean*: Skip creating new files on the destination.

## syncOption.ignoreExisting
*boolean*: Skip updating files that exist on the destination.

## syncOption.update
*boolean*: Update the destination only if a newer version is on the source filesystem.

## ignore
*string[]*: Same behavior as gitignore, all paths relative to context of the current configuration.

**default**: []

## ignoreFile
*string*: Absolute path to the ignore file or Relative path relative to the workspace root folder.

## watcher
*object*.

## watcher.files
*string*: Glob patterns that are watched and when edited outside of the VSCode editor are processed.
Set `uploadOnSave` to false when you watch everything.

## watcher.autoUpload
*boolean*: Upload when the file changed.

Safe to combine with `uploadOnSave`. A save inside VS Code is claimed before the
file is written, so the watcher skips it and only `uploadOnSave` uploads — one
upload per Ctrl+S, not two. Writes from outside the editor (an AI agent, a build
step) never go through that path, so the watcher still picks them up.

**default**: true


### Overriding the watcher per profile

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

## watcher.autoDelete
*boolean*: Delete the remote file or folder when the local one is deleted.

Off by default. Turn it on to keep the remote in step with local deletions
instead of leaving orphaned files behind:

```json
"watcher": {
  "files": "**/*",
  "autoUpload": true,
  "autoDelete": true
}
```

> **Warning**: this deletes on the server, and it is driven by local filesystem
> events. Switching Git branches, or an `ignore` pattern that is wider than you
> expect, can remove remote content you meant to keep. Folder deletes are
> recursive. Enable [backup.onDelete](#backupondelete) to keep a restorable copy
> of everything a delete removes.

Renames and moves are not covered by this option. The watcher sees them as a
delete plus a create, so with `autoDelete` on the old remote file is removed and
the new one re-uploaded rather than renamed in place. Enable
[watcher.autoRename](#watcherautorename) to rename on the server instead, or use
**SFTP: Rename Remote** in the Remote Explorer for a one-off.

**default**: false

## watcher.autoRename
*boolean*: Rename or move on the server when you rename or move a file/folder
inside VS Code, instead of re-uploading it.

Off by default. With it on, renaming a folder costs a **single** server-side
request no matter how many files it holds, and no file contents cross the
network:

```json
"watcher": {
  "files": "**/*",
  "autoUpload": true,
  "autoRename": true
}
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

**default**: false

## remoteTimeOffsetInHours
*number*: The number of hours difference between the local machine and the remote server (remote minus local).

**default**: 0

## remoteExplorer
*object*.

## remoteExplorer.filesExclude
*string[]*: Configure that patterns for excluding files and folders.
The Remote Explorer decides which files and folders to show or hide based on this setting.


## remoteExplorer.enableDragAndDrop
*boolean*: Allow dragging files and folders inside the Remote Explorer to move
them on the server.

Off by default. It is enabled per configuration, so you can turn it on for a
staging server and leave it off for production:

```json
"remoteExplorer": {
  "enableDragAndDrop": true
}
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

**default**: false

## concurrency
*number*: Maximum number of files transferred simultaneously.

Concurrent file transfers share the same SSH session; their streams and SFTP requests are multiplexed over a single connection and SFTP channel.

Suggested values:

- `4`: safe default for shared or restricted servers.
- `8`: good starting point for modern dedicated OpenSSH servers.
- `16`: high performance on fast, modern dedicated OpenSSH servers.

Higher values increase the number of open files and outstanding SFTP requests, so raise the value gradually and test with your server.

**default**: 4

## connectTimeout
*number*: The maximum connection time.

**default**: 10000

## keepalive
*number*: How often (in milliseconds) to send a keepalive packet (SFTP) or `NOOP` command (FTP) to keep the control connection alive. Increase this value if the server still closes idle connections, or set to `0` to disable keepalives entirely.

**default**: 30000

## limitOpenFilesOnRemote
*mixed*: Limit open file descriptors to the specific number in a remote server.
Set to true for using default `limit(222)`. Do not set this unless you have to.

**default**: false

## backup
*object*: Configure file backups. Before a remote file is overwritten by an upload or sync-to-remote operation, a copy is stored in the configured folder. The copy can be kept on the remote server or in the local workspace.

**default**:
```json
{
  "backup": {
    "enabled": false,
    "location": "remote",
    "folder": ".vscode/sftp-backup",
    "versions": 5
  }
}
```

## backup.enabled
*boolean*: Enable backups of overwritten remote files.

**default**: false

## backup.location
*enum*: Where to store backup copies.
- `"remote"` - Keep backups on the server under `remotePath`.
- `"local"` - Keep backups in the workspace root. The directory structure of the remote file is preserved inside the backup folder.

**default**: `"remote"`

## backup.folder
*string*: Folder where backups are stored. Resolved relative to `remotePath` when `location` is `"remote"`, or relative to the workspace root when `location` is `"local"`. This folder is automatically excluded from sync and the Remote Explorer.

**default**: `.vscode/sftp-backup`

## backup.versions
*number*: Maximum number of backup versions to keep per file. Set to `0` to disable backups even when `enabled` is `true`.

**default**: 5

## backup.onDelete
*boolean*: Also back up files before they are **deleted** from the server, not
just before they are overwritten.

Off by default, and only takes effect when `backup.enabled` is `true` and
`backup.versions` is greater than `0`.

```json
"backup": {
  "enabled": true,
  "location": "remote",
  "folder": ".vscode/sftp-backup",
  "versions": 5,
  "onDelete": true
}
```

With it on, every delete route is covered: **SFTP: Delete Remote**,
[watcher.autoDelete](#watcherautodelete), and the deletions performed by
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
> deleting it can take a long time and move a lot of data. This is the trade
> for being able to undo a delete.

**default**: false

***

# SFTP only configuration


## agent
*string*: Path to ssh-agent's UNIX socket for ssh-agent-based user authentication.
Windows users must set to 'pageant' for authenticating with Pagenat or (actual) path to a Cygwin "UNIX socket".
Id get more stability because some client/server have some sort of configured/hard coded limit.

## privateKeyPath
*string*: Absolute path to user private key.

## passphrase
*mixed*: For an encrypted private key, this is the passphrase string used to decrypt it.
Set to true for enable passphrase dialog. This will prevent from using cleartext passphrase in this config.

## interactiveAuth
*boolean*|*string[]*: Enable keyboard interaction authentication mechanism. Set to true to enable `verifyCode` dialog.
For example using Google Authentication (multi-factor). Or pass array of predefined phrases to automatically enter them without user prompting.

Note: *Requires the server to have keyboard-interactive authentication enabled.*

**default**: false

## algorithms
Explicit overrides for the default transport layer algorithms used for the connection.

**default**:
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
      "aes128-gcm",
			"aes128-gcm@openssh.com",
			"aes256-gcm",
			"aes256-gcm@openssh.com",
			"aes128-cbc",
			"aes192-cbc",
			"aes256-cbc",
			"aes128-ctr",
			"aes192-ctr",
			"aes256-ctr"
    ],
    "serverHostKey": [
      "ssh-rsa",
      "ssh-dss",
      "ssh-ed25519",
      "ecdsa-sha2-nistp256",
      "ecdsa-sha2-nistp384",
      "ecdsa-sha2-nistp521",
      "rsa-sha2-512",
      "rsa-sha2-256"
    ],
    "hmac": [
      "hmac-sha2-256",
      "hmac-sha2-512"
    ]
  },
}
```

## sshConfigPath
Absolute path to your SSH configuration file.

**default**: `~/.ssh/config`

## sshCustomParams
Extra parameters appended to the SSH command used by "Open SSH in Terminal".

***

# FTP(s) only configuration

## secure
*mixed*: Set to true for both control and data connection encryption.
Set to `control` for control encryption only, or `implicit` for implicitly encrypted control connection (this mode is deprecated in modern times, but usually uses port 990).

**default**: false

## secureOptions
Additional options to be passed to `tls.connect()`.
See [TLS connect options callback](https://nodejs.org/api/tls.html#tls_tls_connect_options_callback).
