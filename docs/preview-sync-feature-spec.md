# Feature Proposal: Preview Sync (Dry-Run Sync)

**Extension:** sftp-neo
**Author of proposal:** Drafted with Claude, based on public repo description
**Status:** Draft / RFC

---

## 1. Problem Statement

sftp-neo already supports per-file diff (right-click → diff local vs remote) and full bulk sync (Local → Remote, Remote → Local, bi-directional). The gap is between these two: bulk sync currently has no "preview" step. Users must trust that the sync will do the right thing across an entire folder before committing, which is the most common source of anxiety and support requests in every SFTP/sync tool in this space (liximomo/sftp, vscode-sftp-plus, etc. all have open issues about accidental overwrites).

**Goal:** Let users see exactly what a sync operation will do — before it happens — and select/deselect individual files, without needing to trust a black box.

---

## 2. Feature Summary

A new command, **`SFTP Neo: Preview Sync`**, that:

- Walks the local and remote trees for the active sync scope (respecting existing ignore rules)
- Classifies every file into a change category
- Displays the result as a checkable tree (reusing the existing Remote Explorer UI component)
- Lets the user deselect specific files/folders
- Only then executes the transfer for the confirmed subset, via the existing upload/download functions

This command is also inserted automatically as a **confirmation step** before:
- `Sync: Local → Remote`
- `Sync: Remote → Local`
- `Sync: Bi-directional`

(with a setting to skip the preview for users who want the old one-click behavior)

---

## 3. User Flow

1. User runs `Sync: Local → Remote` (or Preview Sync directly) on a folder/profile.
2. Extension walks both trees, applying the profile's ignore rules.
3. Extension compares each matched path (reusing the existing single-file diff/compare logic already used for the right-click diff feature).
4. Results appear in a tree view, grouped by status:
   - ➕ **Add to remote** — exists locally, not remote
   - ➕ **Add to local** — exists remote, not locally (download / bi-directional only)
   - ✏️ **Modified** — exists on both sides, content differs
   - ⚠️ **Conflict** — both sides changed independently since last sync (see §5)
   - ➖ **Delete on remote** / **Delete on local** — if delete-on-sync is enabled
5. Each `Modified`/`Conflict` row has a "View Diff" action that reuses the existing diff command.
6. User can deselect any file/folder via checkbox (default: everything selected except conflicts, which default to unchecked and require explicit review).
7. User clicks **Sync Selected**, which passes the confirmed file list into the existing transfer functions — no new transfer/auth code required.

---

## 4. Classification Logic

Reuses the comparison primitive already implemented for the single-file diff feature (assumed to compare mtime and/or hash/size). Preview Sync applies it in a loop across the full sync scope instead of a single file:

```
for each path in union(localTree, remoteTree) not excluded by ignore rules:
    if not existsRemote(path): classify as "add-remote"
    elif not existsLocal(path): classify as "add-local"
    elif contentDiffers(path):
        if conflictDetectionEnabled and bothChangedSinceLastSync(path):
            classify as "conflict"
        else:
            classify as "modified"
    else:
        skip (already in sync)
```

---

## 5. Conflict Detection (v2 / fast-follow)

True conflict detection (both sides changed independently, not just "different") requires remembering the state at last successful sync. Proposed: a lightweight per-profile ledger file.

**Location:** `.vscode/.sftp-neo-cache/<profile-name>.json`

**Shape:**
```json
{
  "src/index.php": {
    "hash": "a1b2c3...",
    "mtime": 1751600000,
    "lastSyncedAt": 1751600005,
    "direction": "upload"
  }
}
```

Updated automatically after every successful transfer (single-file or bulk). Used only to distinguish "modified" (one side changed) from "conflict" (both sides changed since the ledger entry). Not required for v1 — Preview Sync can ship without it, treating all differences as "modified," and conflict detection can be added once the ledger exists.

---

## 6. UI Notes

- Reuse the existing Remote Explorer `TreeDataProvider` rather than building a new UI paradigm — group nodes under status headers instead of folder structure, or offer a toggle between "by status" and "by folder path" grouping.
- Status bar or panel title should show a quick count, e.g. `12 to upload · 2 conflicts`.
- A settings option: `sftpNeo.sync.previewBeforeSync: true | false` (default `true`) to let power users skip the confirmation step and keep the current one-click sync behavior.
- Conflicts default to **unchecked** in the tree so users can't accidentally overwrite either side without looking.

---

## 7. Implementation Notes / Why This Is Low Risk

- **No new transfer or auth code.** Preview Sync only adds a read-and-compare pass and a UI filter; the actual upload/download calls are the existing functions, invoked with a restricted file list.
- **No new UI paradigm.** Extends the existing Remote Explorer tree component and existing diff command.
- **Incremental delivery path:**
  - **v1:** Flat list of pending changes (add/modified/delete) + confirm button. No conflict detection.
  - **v2:** Tree view with checkboxes, grouping, and per-file diff links.
  - **v3:** Ledger-based conflict detection (§5).

---

## 8. Open Questions

- Should ignore-rule evaluation for Preview Sync exactly match the File Watcher's ignore rules, or should users be able to set a separate "preview scope"?
- For very large trees (thousands of files), should the tree walk be paginated/streamed, or is a progress notification with a hard cap (e.g. "first 500 differences shown") sufficient for v1?
- Should `.gitignore` be auto-respected in addition to `sftp.json`'s `ignore` array (related but separate feature — see prior discussion)?

---

*This document is a starting proposal, not a finished spec. Adjust naming, file locations, and defaults to match the actual sftp-neo codebase and conventions.*
