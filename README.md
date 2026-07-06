<div align="center">

# 🚀 SFTP Neo

**Sync your code to any server without leaving VS Code.**

🔒 **More Secure** · 📦 **Updated Libraries** · ⭐ **More Features**

[![VS Code Marketplace](https://vsmarketplacebadges.dev/version/philipdaoud.sftp-neo.svg?style=flat-square&label=Marketplace&color=007ACC&logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=philipdaoud.sftp-neo)
[![Open VSX](https://img.shields.io/badge/Open%20VSX-PhilipDaoud.sftp--neo-45B39D?style=flat-square&logo=eclipseide)](https://open-vsx.org/extension/PhilipDaoud/sftp-neo)
[![GitHub Repo](https://img.shields.io/badge/Releases-GitHub-181717?style=flat-square&logo=github)](https://github.com/philipdaoud/sftp-neo/releases)
[![License](https://img.shields.io/github/license/philipdaoud/sftp-neo?style=flat-square&color=green)](./LICENSE)

</div>

> 🍴 **Forked & Modernized** from [Natizyskunk/vscode-sftp](https://github.com/Natizyskunk/vscode-sftp), originally based on the abandoned [liximomo/vscode-sftp](https://github.com/liximomo/vscode-sftp). Updated dependencies, new features, and full compatibility with the latest VS Code APIs.

---

## 🎉 What's New in v3.1.0 — Local or Remote File Backups

<div align="center">

### 🛡️ Never Lose a File Again

**Automatic versioned backups** on every upload & sync. Before any remote file is overwritten, SFTP Neo saves a timestamped copy — either on the server or in your local workspace. Browse, restore, or delete old versions directly from VS Code.

</div>

| | |
|:---|:---|
| 🔄 **Automatic Backups** | Every upload/sync creates a timestamped backup before overwriting the remote file |
| 💻 **Local or Remote Storage** | Choose whether backups live on the server (`"location": "remote"`) or in your workspace (`"location": "local"`) |
| 🎛️ **Configurable Retention** | Set how many versions to keep (`versions: 5`) — old ones auto-prune |
| 📂 **Context-Aware Panel** | Click any file in Remote Explorer → see its backup history instantly |
| 🔄 **One-Click Restore** | Right-click any backup to restore it to the live remote file |
| 🔒 **Failsafe Design** | Backup failures never block your upload — your code always goes live |

> ⚡ [**Jump to Backup Setup →**](#-file-backups)

---

## 🎉 Previous Releases

### v3.0.5

#### 🔕 "Don't Show Again" for Plaintext Password Warning
If you choose to keep a password in `sftp.json`, the security warning now offers a **"Don't show again"** button. Your choice is saved in the global user setting `sftp.suppressPlaintextPasswordWarning`, so the warning stays suppressed across all workspaces.

#### 🖥️ Workspace-Scoped SSH Host Keys
Multiple projects connecting to the same development server (same IP and port) — common with containers or multi-tenant setups — no longer trigger false **"SSH host key has CHANGED"** errors. Host keys are now stored per workspace, and existing `host:port` entries are migrated automatically when the key still matches.

### v3.0 — Remote File Backups
Introduced automatic versioned backups before every upload/sync, with a dedicated panel to browse, restore, and delete backup versions.

---

## 📑 Quick Links

[✨ Features](#-features) · [⚡ Quick Start](#-quick-start) · [🔧 Config Examples](#-config-examples) · [🔐 Security](#-security) · [🐛 Debug](#-debug) · [❓ FAQ](./FAQ.md)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🌐 **Remote Explorer** | Browse & manage remote files like a local filesystem |
| ⬆️⬇️ **Upload / Download** | Single files, folders, or entire projects |
| 🔄 **Sync** | Bi-directional or one-way directory sync |
| 💾 **Upload on Save** | Auto-push changes as you code |
| 👁️ **File Watcher** | Auto-upload on external file changes |
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

> 📖 For the full list of options check the [Wiki](https://github.com/philipdaoud/sftp-neo/wiki/Configuration).

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

## ❓ FAQ

See [FAQ.md](./FAQ.md) for common questions and solutions.

---

<div align="center">

Made with ☕ & 🐛 squashing by [Philip Daoud](https://github.com/PhilipDaoud)

</div>
