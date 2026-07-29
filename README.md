<div align="center">

# 🚀 SFTP Neo

**Sync your code to any server without leaving VS Code.**

🔒 **More Secure** · 📦 **Updated Libraries** · ⭐ **More Features**

[![VS Code Marketplace](https://vsmarketplacebadges.dev/version/philipdaoud.sftp-neo.png?style=flat-square&label=Marketplace&color=007ACC&logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=philipdaoud.sftp-neo)
[![Open VSX](https://img.shields.io/badge/Open%20VSX-PhilipDaoud.sftp--neo-45B39D?style=flat-square&logo=eclipseide)](https://open-vsx.org/extension/PhilipDaoud/sftp-neo)
[![GitHub Repo](https://img.shields.io/badge/Releases-GitHub-181717?style=flat-square&logo=github)](https://github.com/philipdaoud/sftp-neo/releases)
[![License](https://img.shields.io/github/license/philipdaoud/sftp-neo?style=flat-square&color=green)](./LICENSE)

</div>

---

> **Forked & Modernized** from [Natizyskunk/vscode-sftp](https://github.com/Natizyskunk/vscode-sftp), originally based on the abandoned [liximomo/vscode-sftp](https://github.com/liximomo/vscode-sftp). Updated dependencies, new features, and full compatibility with the latest VS Code APIs.

---


## 📑 Quick Links

<div align="center">

### ✨ [Features](#-features) &emsp;·&emsp; ⚡ [Quick Start](#-quick-start) &emsp;·&emsp; 🔧 [Config Examples](#-config-examples) &emsp;·&emsp; 📖 [Configuration](./docs/configuration.md) 
### 🔐 [Security](#-security) &emsp;·&emsp; 🔑 [SSH Authentication](#-ssh-authentication) &emsp;·&emsp; 🐛 [Debug](#-debug) &emsp;·&emsp; ❓ [FAQ](./FAQ.md)

</div>



---

## 🎉 What's New in v3.4.0 — Rename, Move & Safer Deletes

Manage remote files without switching to FileZilla or an SSH terminal.

### ✏️ Rename & Move on the Server
`SFTP: Rename Remote` renames or moves a file or folder **on the server** — a single request, no re-upload, however large the folder. Include a `/` in the new name to move it somewhere else.

### 🖱️ Drag to Move
Set `"remoteExplorer": { "enableDragAndDrop": true }` and drag items around the Remote Explorer to reorganize the server. Also a server-side rename, so nothing is transferred.

### 🔁 Local Renames Follow Along
`"watcher": { "autoRename": true }` turns a rename inside VS Code into a server-side rename instead of the old delete-and-re-upload, which used to leave the old folder orphaned.

### 🗑️ Deletes You Can Undo
`"backup": { "onDelete": true }` saves a copy of everything a delete removes, restorable from the **Backups** panel. Deleting a folder backs up its contents first, and the delete is aborted if any copy fails.

`SFTP: Delete Remote` also moved out of hiding — it's now in the local file explorer context menu and the Command Palette, retitled so it can't be mistaken for a local delete.

### 🔧 Fixes
- `uploadOnSave` and `watcher.autoUpload` no longer upload the same file twice on a Ctrl+S — safe to run both.
- Profiles can now override `watcher`, so auto-upload can be on for dev and off for prod. Switching profiles rebuilds the watcher immediately.
- `SFTP: Upload Changed Files` now actually applies Git renames (it silently failed before), and reports failures instead of swallowing them.

> All new options default to **off** — nothing changes until you opt in. See the [full option reference](#-every-option-with-defaults).

---

## 🎉 Previous Releases

| Version | Highlights |
|---------|------------|
| **v3.3.0** | `keepalive` for idle connections, automatic reconnect on dropped sessions, watcher respects `ignore` rules |
| **v3.2.0** | [Remote Explorer Filter](./docs/commands.md#remote-explorer-filter) — live client-side filtering of the sidebar |
| **v3.1.0** | Backups can be stored locally or on the server via `backup.location` |
| **v3.0.5** | "Don't show again" on the plaintext-password warning, workspace-scoped SSH host keys |
| **v3.0** | Automatic versioned backups before every upload, with a panel to browse and restore |

> 📖 Full history in the [CHANGELOG](./CHANGELOG.md).

---


## ✨ Features

| Feature | Description |
|---------|-------------|
| 🌐 **Remote Explorer** | Browse & manage remote files like a local filesystem |
| 🔍 **Remote Explorer Filter** | Live client-side filter for files and folders already shown in the sidebar |
| ⬆️⬇️ **Upload / Download** | Single files, folders, or entire projects |
| 🔄 **Sync** | Bi-directional or one-way directory sync |
| ✏️ **Rename / Move / Delete** | Manage remote files in place — renames and moves are server-side, so nothing is re-uploaded |
| 🖱️ **Drag to Move** | Reorganize the server by dragging inside the Remote Explorer (opt-in) |
| 💾 **Upload on Save** | Auto-push changes as you code |
| 👁️ **File Watcher** | Auto-upload on external file changes — safe to combine with Upload on Save |
| 🎭 **Profiles** | Switch between dev / staging / prod in one click |
| 🔒 **Secure Storage** | Passwords saved in your OS keychain — never in `sftp.json` |
| 📂 **Multi-Context** | Sync different local folders to different servers |
| 🔗 **SSH Hopping** | Jump through bastion hosts to reach internal servers |
| 🖥️ **SSH Terminal** | Open an SSH connection straight from the sidebar |
| 🛡️ **File Backups** | Automatic versioned backups before every upload with local or remote storage |
| 🔕 **Password Warning Toggle** | "Don't show again" on the plaintext-password security warning |
| 🖥️ **Per-Workspace Host Keys** | Independent SSH known-host entries per workspace for shared dev servers |

---

## ⚡ Quick Start

### 1. Install

Grab it from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=philipdaoud.sftp-neo) or install the `.vsix` from [Releases](https://github.com/philipdaoud/sftp-neo/releases).

### 2. Configure

Open the SFTP sidebar from the activity bar. If no config exists yet, click **"Create SFTP Config"** in the welcome view. You can also open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:

```
SFTP: Config
```

A `sftp.json` file is created under `.vscode`. Fill in your server details:

```json
{
  "name": "My Server",
  "host": "example.com",
  "protocol": "sftp",
  "port": 22,
  "username": "root",
  "remotePath": "/var/www/html",
  "uploadOnSave": true,
  "backup": {
    "enabled": false,
    "location": "remote",
    "folder": ".vscode/sftp-backup",
    "versions": 5
  }
}
```

> 💡 **No password?** Leave `"password"` out (or set it to `null`) — you'll be prompted once and can save it securely to your OS keychain. See [🔐 Security](#-security).  
> 🛡️ **Backups** are disabled by default. Set `"backup.enabled": true` to keep timestamped versions of remote files before every upload/sync. See [🛡️ File Backups](#-file-backups).

### 3. Go!

| Action | Command Palette |
|--------|-----------------|
| Download project | `SFTP: Download Project` |
| Upload current file | `SFTP: Upload Active File` |
| Sync local → remote | `SFTP: Sync Local -> Remote` |
| Browse remote | `View: Show SFTP` (sidebar) |
| Manage backups | Select a file in Remote Explorer → **Backups** panel |

Right-click any file or folder in the **Explorer** for quick upload / download / diff options.

---

## 🔧 Config Examples

### 🎭 Profiles
Switch between environments on the fly:

```json
{
  "username": "deploy",
  "remotePath": "/app",
  "profiles": {
    "dev": { "host": "dev.example.com", "uploadOnSave": true },
    "prod": { "host": "prod.example.com", "uploadOnSave": false }
  },
  "defaultProfile": "dev"
}
```

Use `SFTP: Set Profile` to switch.

A profile can override any top-level option, including `watcher` — useful when
something outside VS Code edits your files (an AI coding tool, a build step) and
you want those changes uploaded automatically on dev but never on prod:

```json
{
  "username": "deploy",
  "remotePath": "/app",
  "watcher": { "files": "**/*", "autoUpload": false },
  "profiles": {
    "dev":  { "host": "dev.example.com",  "watcher": { "files": "**/*", "autoUpload": true } },
    "prod": { "host": "prod.example.com", "watcher": { "files": "**/*", "autoUpload": false } }
  },
  "defaultProfile": "dev"
}
```

Object options are replaced wholesale rather than merged key-by-key, so repeat
`files` in each profile. Switching profiles rebuilds the watcher immediately —
no reload needed.

### 📂 Multiple Contexts
Sync different parts of your project to different places:

```json
[
  {
    "name": "Frontend",
    "context": "client/dist",
    "host": "cdn.example.com",
    "remotePath": "/static"
  },
  {
    "name": "Backend",
    "context": "server",
    "host": "api.example.com",
    "remotePath": "/var/api"
  }
]
```

### 🔗 Connection Hopping
Reach a server through a bastion host:

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

### 📋 Every Option, With Defaults

You only need the handful of options your setup actually uses — the block below
is a **reference**, not a starting point. Copy the lines you want, not the whole
thing.

<details>
<summary>Show the full <code>sftp.json</code> reference</summary>(./docs/configuration.md) 

```json
{
  "name": "My Server",
  "context": ".",
  "protocol": "sftp",

  "host": "example.com",
  "port": 22,
  "username": "user",
  "password": null,
  "remotePath": "/var/www/html",
  "connectTimeout": 10000,
  "keepalive": 30000,
  "concurrency": 4,

  "privateKeyPath": "~/.ssh/id_rsa",
  "passphrase": null,
  "agent": null,
  "interactiveAuth": false,
  "sshConfigPath": "~/.ssh/config",

  "uploadOnSave": false,
  "downloadOnOpen": false,
  "useTempFile": false,
  "openSsh": false,

  "ignore": [".vscode", ".git", ".DS_Store"],
  "ignoreFile": ".gitignore",

  "watcher": {
    "files": "**/*",
    "autoUpload": false,
    "autoDelete": false,
    "autoRename": false
  },

  "syncOption": {
    "delete": false,
    "skipCreate": false,
    "ignoreExisting": false,
    "update": false
  },

  "backup": {
    "enabled": false,
    "location": "remote",
    "folder": ".vscode/sftp-backup",
    "versions": 5,
    "onDelete": false
  },

  "remoteExplorer": {
    "filesExclude": [],
    "order": 0,
    "enableDragAndDrop": false
  },

  "hooks": {
    "preUpload": "",
    "postUpload": "",
    "preDownload": "",
    "postDownload": "",
    "preSync": "",
    "postSync": ""
  },

  "filePerm": 644,
  "dirPerm": 755,
  "remoteTimeOffsetInHours": 0,
  "limitOpenFilesOnRemote": false,

  "profiles": {
    "dev": { "host": "dev.example.com" },
    "prod": { "host": "prod.example.com" }
  },
  "defaultProfile": "dev"
}
```

FTP-only options: `secure`, `secureOptions`, `passive`. SFTP-only extras:
`algorithms`, `sshCustomParams`, and `hop` (bastion hosts — see above).

`sftp.json` is strict JSON — **comments are not supported**, so don't paste `//`
notes into it.

Drop `privateKeyPath` / `passphrase` / `agent` if you authenticate with a
password, and drop `password` if you don't (you'll be prompted once and can save
it to your OS keychain).

The four options worth understanding before switching on:

| Option | Default | Why it's off |
|---|---|---|
| `watcher.autoUpload` | `false` | Uploads on any change the watcher sees, including from tools outside VS Code. Pair with `uploadOnSave` freely — a Ctrl+S will not upload twice. |
| `watcher.autoDelete` | `false` | **Destructive.** Deletes on the server when a local file disappears. A branch switch or a too-broad `ignore` can remove remote content. Folder deletes are recursive. |
| `watcher.autoRename` | `false` | Turns a rename into a server-side rename instead of a re-upload. Only covers renames made **through VS Code** — `mv` in a terminal still looks like delete + create. |
| `backup.onDelete` | `false` | Makes deletes recoverable, but copies file contents, so deleting a large folder moves a lot of data. |

> 📖 **Every option explained** — types, defaults, and behaviour — in
> [docs/options.md](./docs/options.md).

</details>

---

## 🔐 Security

SFTP Neo stores passwords & passphrases in your **OS credential store** (macOS Keychain, Windows Credential Manager, Linux libsecret) via VS Code's Secret Storage API — so your `sftp.json` stays clean and commit-safe.

**How to use it:**

1. Set `"password": null` (or omit it) in `sftp.json`:
   ```json
   {
     "host": "example.com",
     "username": "root",
     "password": null,
     "remotePath": "/var/www"
   }
   ```
2. Connect — you'll be prompted for the password.
3. Click **"Save password to Secret Storage"**.
4. Future connections are automatic & encrypted.

The same works for private key `passphrase`.

> 🧹 Manage saved credentials anytime with `SFTP: Delete Saved Password`.

---

## 🔑 SSH Authentication

SFTP Neo supports three ways to authenticate SFTP connections. For both security and convenience, **SSH keys** or **ssh-agent** are recommended over plaintext passwords.

| Method | Best for | Stored in `sftp.json` | Works with **Open SSH in Terminal** |
|--------|----------|----------------------|-------------------------------------|
| `privateKeyPath` | Single key file, no agent running | Path only (never the key contents) | ✅ Yes, with `-i /path/to/key` |
| `agent` | Shared workstation, multiple keys, or fully password-less login | No secrets | ✅ Yes — the most seamless option |
| `password` / `passphrase` | Servers that require it | `null` + Secret Storage (recommended) | ❌ No auto-fill in terminal |

### SSH private key (`privateKeyPath`)

1. **Generate a key pair** (skip if you already have one):
   ```bash
   ssh-keygen -t ed25519 -C "you@example.com"
   ```
   Press Enter to accept the default location (`~/.ssh/id_ed25519`). You can set a passphrase for extra security.

2. **Copy the public key to your server**:
   ```bash
   ssh-copy-id -i ~/.ssh/id_ed25519.pub user@example.com
   ```

3. **Configure SFTP Neo**:
   ```json
   {
     "name": "My Server",
     "host": "example.com",
     "protocol": "sftp",
     "port": 22,
     "username": "user",
     "privateKeyPath": "~/.ssh/id_ed25519",
     "remotePath": "/var/www/html",
     "uploadOnSave": true
   }
   ```

> 💡 **Encrypted key?** Set `"passphrase": true` and SFTP Neo will prompt once, then offer to save it to Secret Storage. Or load the key into ssh-agent (see below) and omit `passphrase`.

### SSH agent (`agent`)

Using an ssh-agent is the most convenient option: your key is unlocked once per session, and both SFTP transfers and **Open SSH in Terminal** work without typing a password.

#### macOS / Linux

1. **Start the agent and add your key**:
   ```bash
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_ed25519
   ```

2. **Get the agent socket**:
   ```bash
   echo $SSH_AUTH_SOCK
   # Example: /tmp/ssh-XXXXXX/agent.12345
   ```

3. **Configure SFTP Neo**:
   ```json
   {
     "host": "example.com",
     "username": "user",
     "agent": "/tmp/ssh-XXXXXX/agent.12345",
     "remotePath": "/var/www/html"
   }
   ```

> 🍎 On macOS, if your key is stored in Keychain, use `ssh-add --apple-use-keychain ~/.ssh/id_ed25519` so you are not prompted after every reboot.

#### Windows

- **Pageant** (PuTTY agent): set `"agent": "pageant"`.
- **Windows OpenSSH agent**: make sure the `OpenSSH Authentication Agent` service is running, then set `"agent": "\\\\.\\pipe\\openssh-ssh-agent"` (the pipe name may differ on older Windows builds).

### Platform-specific tips

| Platform | Tip |
|----------|-----|
| **macOS** | `ssh-add --apple-use-keychain ~/.ssh/id_ed25519` persists the unlocked key across reboots. |
| **Linux** | `ssh-agent` exits when the shell closes. Use your distro’s user service or add the `eval`/`ssh-add` commands to your shell profile to keep it available. |
| **Windows** | For WSL, use the Linux instructions inside WSL. For native Windows, the OpenSSH agent pipe or Pageant are the usual choices. |

### A note on **Open SSH in Terminal**

The sidebar command builds a plain terminal command:

```bash
ssh -t user@host -p 22 -i "/path/to/key"
```

It can automatically use:

- your `privateKeyPath` (`-i ...`)
- your ssh-agent (no extra flags)

It **cannot** auto-type a password or passphrase into the terminal. If you want a fully password-less terminal experience, use an ssh-agent.

---

## 🖥️ Remote Explorer

Browse your remote server directly in the VS Code sidebar.

![Remote Explorer Preview](https://raw.githubusercontent.com/philipdaoud/sftp-neo/master/assets/showcase/remote-explorer.png)

Open it via:
- Command Palette → `View: Show SFTP`
- Or click the **SFTP** icon in the Activity Bar

Select multiple files with `Ctrl`/`Shift` to download or upload in batches.

---

## 🛡️ File Backups

<div align="center">

**Protect your production files. Every upload is reversible.**

</div>

Before any remote file is overwritten by an upload or sync-to-remote operation, SFTP Neo automatically creates a timestamped backup copy. Choose to keep backups on the remote server or in your local workspace. Browse, restore, or delete backup versions without leaving VS Code.

### 🚀 How It Works

#### Remote backups (`"location": "remote"`, default)

```
Before Upload                    After Upload
─────────────────                ─────────────────
remote/index.php                 remote/index.php  ← new content
                                 remote/.vsftp-backup/
                                   └─ index.php.20260612194215007.bak  ← old content
```

#### Local backups (`"location": "local"`)

```
Before Upload                    After Upload
─────────────────                ─────────────────
remote/index.php                 remote/index.php  ← new content
                                 workspace/.vsftp-backup/
                                   └─ index.php.20260612194215007.bak  ← old content
```

The remote directory layout is preserved inside the backup folder so you can mirror the server structure locally.

### ⚙️ Configuration

Add the `backup` object to your `.vscode/sftp.json`:

```json
{
  "name": "Production",
  "host": "example.com",
  "protocol": "sftp",
  "port": 22,
  "username": "root",
  "remotePath": "/var/www/html",
  "uploadOnSave": true,
  "backup": {
    "enabled": true,
    "location": "remote",
    "folder": ".vsftp-backup",
    "versions": 5
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `backup.enabled` | `boolean` | `false` | Master switch. Set to `true` to enable backups. |
| `backup.location` | `string` | `"remote"` | Where backups are stored. `"remote"` keeps them on the server under `remotePath`; `"local"` keeps them in your workspace root. |
| `backup.folder` | `string` | `".vscode/sftp-backup"` | Folder where backups are stored. Resolved relative to `remotePath` when `location` is `"remote"`, or relative to the workspace root when `location` is `"local"`. |
| `backup.versions` | `number` | `5` | Maximum number of backup versions to keep per file. Set to `0` to disable backups even when `enabled` is `true`. |

> 💡 **Tip:** The backup folder is automatically excluded from sync operations and the Remote Explorer — you never have to worry about backups being uploaded or cluttering your file tree.

### 📂 Using the Backups Panel

1. **Enable backups** in your `sftp.json` (see configuration above).
2. **Upload or sync** a file — a backup is created automatically before the overwrite.
3. **Click any file** in the **Remote Explorer** panel.
4. The **Backups** panel (titled **Remote Backups** or **Local Backups** based on your setting) updates to show all backup versions for that file, sorted newest → oldest.

| Action | How |
|--------|-----|
| 🔄 **Restore** | Right-click a backup version → `Restore Backup`. The current live file is backed up first, then replaced. |
| 🗑️ **Delete** | Right-click a backup version → `Delete Backup`. |
| 👁️ **Preview** | Click any backup version to open it in a read-only preview without downloading. |

### 🔒 Safety Guarantees

- **Upload never blocked:** If a backup fails for any reason, the upload still proceeds. Your code always goes live.
- **Auto-pruning:** Old backups beyond your `versions` limit are cleaned up automatically after each upload.
- **No sync loops:** The backup folder is invisible to sync, so local backups are never auto-uploaded and remote backups are never downloaded.
- **Context-aware:** The panel only shows backups for the file you have selected in Remote Explorer.

---

## 🐛 Debug

Need to troubleshoot?

1. Open **Settings** (`Ctrl+,` / `Cmd+,`).
2. Search for `sftp.debug` and set it to `true`.
3. Reload VS Code.
4. View logs in **Output → SFTP**.

---

## 📖 Configuration Reference

See [docs/options.md](./docs/options.md) for every `sftp.json` option — types,
defaults, and behaviour.

---

## ❓ FAQ

See [FAQ.md](./FAQ.md) for common questions and solutions.

---

<div align="center">

Made with ☕ & 🐛 squashing by [Philip Daoud](https://github.com/PhilipDaoud)

</div>
