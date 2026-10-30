# 🤝 Contributing to SFTP Neo

Thanks for helping. Bug reports, ideas, docs fixes, and pull requests are all welcome.

- [🐛 Reporting a bug](#-reporting-a-bug)
- [💡 Suggesting a feature](#-suggesting-a-feature)
- [🛠️ Setting up the project](#%EF%B8%8F-setting-up-the-project)
- [🗺️ Where things live](#%EF%B8%8F-where-things-live)
- [✅ Before you open a pull request](#-before-you-open-a-pull-request)
- [🔐 Security rules](#-security-rules)
- [📬 Opening the pull request](#-opening-the-pull-request)

---

## 🐛 Reporting a bug

1. Check the [FAQ](./FAQ.md) and [existing issues](https://github.com/philipdaoud/sftp-neo/issues). Your problem may already have an answer.
2. Turn on **`sftp.debug`** in Settings, reload VS Code, and reproduce the problem.
3. [Open a bug report](https://github.com/philipdaoud/sftp-neo/issues/new/choose) with:
   - your OS, VS Code version, and SFTP Neo version,
   - the relevant part of `sftp.json`,
   - the log from **View → Output → SFTP**.

> ⚠️ **Remove secrets first.** Never post passwords, passphrases, or private keys, and blank out hostnames and usernames you don't want public.

Found a security problem? Please don't open a public issue. Report it privately through [GitHub security advisories](https://github.com/philipdaoud/sftp-neo/security/advisories/new).

## 💡 Suggesting a feature

[Open a feature request](https://github.com/philipdaoud/sftp-neo/issues/new/choose). Describe the problem you're trying to solve, not only the solution. That makes it easier to find the right design.

---

## 🛠️ Setting up the project

You need **Node.js 20+**, **npm**, **Git**, and **VS Code 1.90+**.

```bash
git clone https://github.com/<your-username>/sftp-neo.git   # your fork
cd sftp-neo
npm install
```

| Command | What it does |
|---|---|
| `npm run dev` | Build in watch mode (development) |
| `npm run compile` | Production build into `dist/extension.js` |
| `npm test` | Run all Jest tests |
| `npx jest test/core/fileService.spec.js` | Run one test file, which is faster while you work |
| `npm run lint` | Lint `src/` with ESLint |
| `npx tsc --noEmit -p .` | Type-check |

**▶️ Try your changes:** open the folder in VS Code and press **F5** (the *Launch Extension* configuration). A second VS Code window opens with your build loaded. Point it at a test server, never a production one.

> 💡 Jest sometimes warns that a worker "failed to exit gracefully". That warning is known and harmless.

---

## 🗺️ Where things live

| Path | Contents |
|---|---|
| `src/commands/` | One file per command, registered automatically. The filename prefix picks the type: `command*`, `fileCommand*`, `fileMultiCommand*` |
| `src/constants.ts` | Every command ID and shared constant |
| `src/fileHandlers/` | Upload, download, sync, diff, rename, and delete logic |
| `src/core/` | File service, file systems (local, SFTP, FTP), SSH and FTP clients, host-key store, backups |
| `src/modules/` | `sftp.json` schema (`config.ts`), Remote Explorer, Transfer Queue, watchers, secrets |
| `schema/` | JSON schema used for `sftp.json` autocomplete and validation |
| `docs/` | User documentation. `docs/options.md` lists every option |
| `test/` | Jest specs (`*.spec.js`), mirroring `src/` |

**Adding a command:** add its ID to `src/constants.ts`, create `src/commands/<prefix><Name>.ts`, declare it in `package.json` under `contributes.commands` (and `menus` if needed), then document it in `docs/commands.md`.

**Adding a `sftp.json` option:** keep these in step, because drift between them is the most common bug:

1. the zod schema in `src/modules/config.ts`,
2. the JSON schema in `schema/`,
3. where the option is used at runtime (usually `src/core/fileService.ts`),
4. `docs/options.md`.

**New dependency?** The published extension ships only the webpack bundle, with no `node_modules`. A new runtime dependency must bundle with webpack; native `.node` add-ons need a pure-JS fallback.

---

## ✅ Before you open a pull request

- [ ] `npm test`, `npm run lint`, and `npx tsc --noEmit -p .` all pass.
- [ ] New logic in `src/core/`, `src/helper/`, or `src/modules/` has a test in the matching `test/` folder.
- [ ] User-facing changes are documented in `docs/` and have an entry in [`CHANGELOG.md`](./CHANGELOG.md) under the upcoming version.
- [ ] The change is focused: no unrelated reformatting or refactoring.
- [ ] Code matches the surrounding style: 2-space indent, single quotes, semicolons.
- [ ] You tried it in the Extension Development Host (**F5**).

## 🔐 Security rules

SFTP Neo handles server credentials and writes to live servers, so these are not negotiable:

- 🙅 Never log passwords, passphrases, private keys, or whole config objects.
- 🔒 Saved credentials belong in VS Code Secret Storage (`src/modules/secrets.ts`), never on disk.
- 🚫 `.vscode` must always stay excluded from transfers.
- 📁 Remote paths must stay inside `remotePath`. Use the helpers in `src/helper/paths.ts` and `src/core/upath.ts`.
- 🧭 Don't weaken host-key verification in `src/core/remote-client/hostKeyStore.ts`.
- 🧯 Destructive operations (delete, overwrite, sync with delete) keep their confirmation prompts and backups.

---

## 📬 Opening the pull request

1. [Fork](https://docs.github.com/en/get-started/quickstart/fork-a-repo) the repository and create a branch from `main`: `git checkout -b fix/short-description`.
2. Commit with a short, imperative message: ✔️ `Add remote rename`, ❌ `Update file.ts`.
3. Keep your branch up to date with `main` (rebase or merge) to avoid conflicts.
4. [Open the pull request](https://github.com/philipdaoud/sftp-neo/compare) against `main`:
   - **Title:** what it does, for example `Fix agent key selection`.
   - **Description:** what changed, why, and how you tested it. Add `Closes #123` if it fixes an issue.

The maintainer reviews every pull request and may ask for changes. Push more commits to the same branch and they appear in the pull request.

Thank you for making SFTP Neo better! 💙
