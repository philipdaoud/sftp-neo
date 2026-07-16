# Common configuration

## name
*string*: A string to identify your configuration.

## context
*string*: A path relative to the workspace root folder.
Use this when you want to map a subfolder to the `remotePath`.

**default**: The workspace root.

## protocol
*string*: `sftp` or `ftp`

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
*string*: Absolute path to the ignore file or relative path relative to the workspace root folder.

## watcher
*object*.

## watcher.files
*string*: Glob patterns that are watched and when edited outside of the VSCode editor are processed.
Set `uploadOnSave` to false when you watch everything.

## watcher.autoUpload
*boolean*: Upload when the file changed.

## watcher.autoDelete
*boolean*: Delete when the file is removed.

## remoteTimeOffsetInHours
*number*: The number of hours difference between the local machine and the remote server (remote minus local).

**default**: 0

## remoteExplorer
*object*.

## remoteExplorer.fileExclude
*string[]*: Configure that patterns for excluding files and folders.
The Remote Explorer decides which files and folders to show or hide based on this setting.

## remoteExplorer.order
*number*: Remote Explorer will ascending sorting by this value. If the values are the same, sort by name.

**default**: 0

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
