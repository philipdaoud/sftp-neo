# ❓ FAQ

Answers to the questions and errors that come up most often. Before anything else, turn on the
debug log: set **`sftp.debug`** to `true` in Settings, reload VS Code, repeat the problem, and
open **View → Output → SFTP**. The log usually names the cause.

**🔌 Connecting**
- [Too many authentication failures](#-too-many-authentication-failures)
- [Timed out while waiting for handshake](#%EF%B8%8F-timed-out-while-waiting-for-handshake)
- [Connection closed right after connecting](#-connection-closed-right-after-connecting)
- [The SSH host key has CHANGED](#-the-ssh-host-key-has-changed)
- [Where is my password stored, and how do I change it?](#-where-is-my-password-stored-and-how-do-i-change-it)

**📦 Transferring files**
- [Error: Failure](#%EF%B8%8F-error-failure)
- [Permission denied, or how do I upload as root?](#-permission-denied-or-how-do-i-upload-as-root)
- [Upload Changed Files does nothing](#%EF%B8%8F-upload-changed-files-does-nothing)
- [Upload the contents of a folder, not the folder itself](#-upload-the-contents-of-a-folder-not-the-folder-itself)
- [Upload changes made outside VS Code (Git, build tools)](#%EF%B8%8F-upload-changes-made-outside-vs-code-git-build-tools)
- [ENFILE: file table overflow (macOS)](#-enfile-file-table-overflow-macos)

**🌐 Remote Explorer**
- [Hidden files (dotfiles) are missing](#-hidden-files-dotfiles-are-missing)

---

## 🔌 Connecting

### 🔑 Too many authentication failures

Your SSH agent holds more keys than the server allows attempts for (`MaxAuthTries`, 6 by default),
and the server gave up before the right key was tried.

Tell SFTP Neo which key to use with `privateKeyPath` (or `IdentityFile` in `~/.ssh/config`), and set
`identitiesOnly` (or `IdentitiesOnly yes`) so only that key is offered. The agent still signs, so no
passphrase is needed:

```json
{
	"agent": "\\\\.\\pipe\\openssh-ssh-agent",
	"privateKeyPath": "~/.ssh/id_ed25519_lab",
	"identitiesOnly": true
}
```

The `agent` value above is for the Windows OpenSSH agent; on macOS and Linux use `"$SSH_AUTH_SOCK"`.
Make sure the key is loaded: `ssh-add -l` should list it.
See [`agent`, `privateKeyPath`, and `identitiesOnly`](docs/options.md#agent-privatekeypath-and-identitiesonly).

### ⏱️ Timed out while waiting for handshake

The server didn't complete the SSH handshake within `connectTimeout` (10 seconds by default).

1. Check `host` and `port`. Can you reach the server with `ssh user@host -p port` from the same machine?
2. A firewall, VPN, or slow network can delay the handshake. Raise the limit, for example
   `"connectTimeout": 30000`.

Time spent on a host-key prompt doesn't count against the timeout.

### 🔌 Connection closed right after connecting

Some older servers close the connection when they can't agree on an algorithm with the client.
Usually the key exchange is the culprit. Override it in `sftp.json`:

```json
{
	"algorithms": {
		"kex": [
			"ecdh-sha2-nistp256",
			"ecdh-sha2-nistp384",
			"ecdh-sha2-nistp521"
		]
	}
}
```

`cipher`, `serverHostKey`, and `hmac` can be overridden the same way.
See [SSH algorithm overrides](docs/options.md#ssh-algorithm-overrides).

### 🧭 The SSH host key has CHANGED

SFTP Neo remembers each server's host key. When it changes, you see the stored and the received
`SHA256:` fingerprints:

- **Expected** (server reinstalled, rebuilt, or migrated)? Choose **Accept New Key**.
- **Not expected?** Cancel, and check the fingerprint with the server's administrator
  (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the server). Someone may be intercepting
  the connection.

**Servers that are rebuilt all the time** (containers, VMs, staging):

- `"hostKeyChecking": "accept-new"` in `sftp.json` trusts unknown hosts without asking. A changed key still asks.
- The user setting [`sftp.skipHostKeyVerification`](docs/setting.md#skiphostkeyverification) lists hosts whose key
  isn't checked at all. It can only be set in your User settings, so a shared project can't turn it on.
  Never list production servers.

### 🔒 Where is my password stored, and how do I change it?

When you choose to save it, the password (or key passphrase) goes into your operating system's
credential store through VS Code's Secret Storage: macOS Keychain, Windows Credential Manager, or
libsecret on Linux. It is never written to `sftp.json`.

To change or remove it, run **`SFTP: Delete Saved Password`**. You'll be asked again on the next connection.

---

## 📦 Transferring files

### ⚠️ Error: Failure

This generic message comes from the server: one of its system calls failed. The server's own SFTP
log usually says why. Two common causes:

- **`remotePath` is a symlink.** Set `remotePath` to the real directory it points to.
- **The server ran out of file descriptors.** Ask for a higher open-files limit, or set
  `"limitOpenFilesOnRemote": true` (or a number, minimum 127) so SFTP Neo keeps fewer files open
  at once. Lowering `concurrency` also helps.

### 🚫 Permission denied, or how do I upload as root?

SFTP transfers always run as the user you log in as. There is no `sudo` for SFTP, so files that
user can't write can't be uploaded. (`sshCustomParams` only changes the **Open SSH in Terminal**
command; it doesn't affect transfers.)

Pick one:

- **Give your user write access** to the target folder, for example by adding it to the group that
  owns the files: `sudo chgrp -R www-data /var/www/html && sudo chmod -R g+w /var/www/html`.
- **Log in as the user that owns the files** (for example a deploy user), instead of root.
- If new files need specific modes, set `filePerm` / `dirPerm` (for example `644` / `755`).

### ⬆️ Upload Changed Files does nothing

**`SFTP: Upload Changed Files`** (`Ctrl+Alt+U`) uploads the files **Git** reports as changed, so it needs:

1. the built-in **Git** extension enabled,
2. the workspace folder to be a Git repository with at least one commit, and
3. at least one changed file (shown in the Source Control view).

It's also in the **Source Control** view's toolbar and in the right-click menu of the *Changes* and
*Staged Changes* groups. You can rebind the shortcut in **Keyboard Shortcuts**:

![Upload Changed Files keyboard shortcut](assets/faq/upload_changed_files_shortcut.png)

### 📂 Upload the contents of a folder, not the folder itself

Set `context` to that folder. Files under it are mapped straight into `remotePath`, so
`build/index.html` uploads to `/var/www/html/index.html`:

```json
{
	"name": "My Server",
	"host": "example.com",
	"protocol": "sftp",
	"username": "deploy",
	"context": "./build",
	"remotePath": "/var/www/html"
}
```

Need several folders going to different places? `sftp.json` can hold an array of configs, each with
its own `context`. See [`context` and multiple configurations](docs/options.md#context-and-multiple-configurations).

### 👁️ Upload changes made outside VS Code (Git, build tools)

`uploadOnSave` only reacts to saves inside VS Code. To also upload files changed by a Git checkout,
a build step, or another tool, turn on the **watcher**:

```json
{
	"name": "My Server",
	"host": "example.com",
	"protocol": "sftp",
	"username": "deploy",
	"remotePath": "/var/www/html",
	"uploadOnSave": true,
	"watcher": {
		"files": "**/*",
		"autoUpload": true,
		"autoDelete": false
	}
}
```

- `uploadOnSave` and `watcher.autoUpload` are safe together: one save is uploaded once, not twice.
- `autoDelete: true` also deletes on the server when a file disappears locally. It's **destructive**:
  a branch switch can remove remote files, so leave it off unless you're sure.
- The watcher only uploads. To bring server changes down, run **`SFTP: Sync Remote -> Local`**, or set
  `"downloadOnOpen": true` to fetch each file when you open it.

See [`uploadOnSave` with `watcher.autoUpload`](docs/options.md#uploadonsave-with-watcherautoupload) and
[`watcher.autoDelete`](docs/options.md#watcherautodelete).

### 🍎 ENFILE: file table overflow (macOS)

macOS limits how many files can be open at once, and a large sync can hit that limit. Raise it:

```sh
echo kern.maxfiles=65536 | sudo tee -a /etc/sysctl.conf
echo kern.maxfilesperproc=65536 | sudo tee -a /etc/sysctl.conf
sudo sysctl -w kern.maxfiles=65536
sudo sysctl -w kern.maxfilesperproc=65536
ulimit -n 65536
```

Then restart VS Code. Lowering `concurrency` in `sftp.json` also reduces the number of open files.

---

## 🌐 Remote Explorer

### 👻 Hidden files (dotfiles) are missing

**FTP with ProFTPD:** the server hides dotfiles from directory listings by default. Edit `proftpd.conf`.
Depending on your installation, it's one of:

- `/etc/proftpd.conf`
- `/etc/proftpd/proftpd.conf`
- `/usr/local/etc/proftpd.conf`
- `/usr/local/etc/proftpd/proftpd.conf`

Change `ListOptions` from `"-l"` to `"-la"`, then restart ProFTPD:

```conf
<Global>
  ListOptions "-la"
</Global>
```

**Any protocol:** check `remoteExplorer.filesExclude` in `sftp.json`. Patterns listed there are hidden
from the Remote Explorer on purpose.

---

Still stuck? [Open an issue](https://github.com/philipdaoud/sftp-neo/issues/new/choose) and include the
SFTP output log (with `sftp.debug` on). Remove hostnames and usernames you don't want to share.
