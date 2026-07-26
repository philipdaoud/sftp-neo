import { isLocalPathAtOrUnder } from '../helper';

/**
 * Paths the file watcher should ignore because something else is handling them.
 *
 * An edit made inside VS Code reaches us twice: once through the event we act
 * on, and once through the FileSystemWatcher noticing the same write. Two
 * cases need that second signal dropped.
 *
 * - **Rename.** The watcher sees a rename as delete-then-create. Left alone it
 *   would undo or duplicate the server-side rename — at best re-uploading
 *   everything we just moved for free, at worst recursively deleting the remote
 *   folder before the rename runs, taking any remote-only files with it.
 * - **Save.** With `uploadOnSave` and `watcher.autoUpload` both on, a Ctrl+S
 *   uploads once from the save handler and again from the watcher.
 *
 * Both register their suppression on the corresponding `onWill…` event, i.e.
 * before the change reaches disk, so it is always in place before the watcher
 * can observe anything.
 *
 * Suppression is purely time-based rather than consumed by the first matching
 * event: a single write can produce more than one watcher event depending on
 * platform, and a consume-on-first-use marker would let the second through.
 */

// Generous next to the watcher's 550ms debounce: a large folder rename can
// trickle filesystem events out over several seconds.
const SUPPRESSION_TTL = 10 * 1000;

/**
 * A save writes one file, so its events arrive promptly. Kept short to narrow
 * the window in which a genuine external change to the same file is ignored.
 */
export const SAVE_SUPPRESSION_TTL = 2 * 1000;

// fsPath -> expiry timestamp. Entries are roots: everything below them is
// suppressed too, which is what makes folder renames work.
const suppressed = new Map<string, number>();

function sweep(now: number) {
  for (const [fsPath, expiresAt] of Array.from(suppressed.entries())) {
    if (expiresAt <= now) {
      suppressed.delete(fsPath);
    }
  }
}

/**
 * Ignore watcher events for `fsPath` and its descendants for a short while.
 * Calling it again for the same path extends the window.
 */
export function suppressWatcherFor(fsPath: string, ttl: number = SUPPRESSION_TTL) {
  const now = Date.now();
  sweep(now);
  suppressed.set(fsPath, now + ttl);
}

export function isWatcherSuppressed(fsPath: string): boolean {
  const now = Date.now();
  sweep(now);

  for (const root of suppressed.keys()) {
    if (isLocalPathAtOrUnder(root, fsPath)) {
      return true;
    }
  }

  return false;
}

/**
 * Release a suppression early, so the watcher takes over again. Used when a
 * remote rename fails and the normal upload path has to pick up the slack.
 */
export function releaseWatcherSuppression(fsPath: string) {
  suppressed.delete(fsPath);
}

// Testing seam.
export function _reset() {
  suppressed.clear();
}
