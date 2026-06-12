<div align="center">

# 🚀 SFTP Neo

**Sync your code to any server without leaving VS Code.**

🔒 **More Secure** · 📦 **Updated Libraries** · ⭐ **More Features**

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/philipdaoud.sftp-neo?style=flat-square&label=Marketplace&color=007ACC&logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=philipdaoud.sftp-neo)
[![GitHub Release](https://img.shields.io/github/v/release/philipdaoud/sftp-neo?style=flat-square&label=VSIX&color=181717&logo=github)](https://github.com/philipdaoud/sftp-neo/releases)
[![License](https://img.shields.io/github/license/philipdaoud/sftp-neo?style=flat-square&color=green)](./LICENSE)

</div>

> 🍴 **Forked & Modernized** from [Natizyskunk/vscode-sftp](https://github.com/Natizyskunk/vscode-sftp), originally based on the abandoned [liximomo/vscode-sftp](https://github.com/liximomo/vscode-sftp). Updated dependencies, new features, and full compatibility with the latest VS Code APIs.

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

---

## ⚡ Quick Start

### 1. Install

Grab it from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=philipdaoud.sftp-neo) or install the `.vsix` from [Releases](https://github.com/philipdaoud/sftp-neo/releases).

### 2. Configure

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:

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
  "uploadOnSave": true
}
```

> 💡 **No password?** Leave `"password"` out (or set it to `null`) — you'll be prompted once and can save it securely to your OS keychain. See [🔐 Security](#-security).

### 3. Go!

| Action | Command Palette |
|--------|-----------------|
| Download project | `SFTP: Download Project` |
| Upload current file | `SFTP: Upload Active File` |
| Sync local → remote | `SFTP: Sync Local -> Remote` |
| Browse remote | `View: Show SFTP` (sidebar) |

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
