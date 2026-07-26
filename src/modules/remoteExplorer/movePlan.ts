import upath from '../../core/upath';
import { isRemotePathAtOrUnder } from '../../helper';

export interface MoveCandidate {
  fsPath: string;
  remoteId: number;
  isDirectory: boolean;
}

export interface PlannedMove {
  from: string;
  to: string;
  isDirectory: boolean;
}

export interface MovePlan {
  moves: PlannedMove[];
  // Set when the whole drop is refused. Nothing is moved in that case, rather
  // than moving the valid half of a selection.
  rejection?: string;
}

/**
 * Work out what a drop should actually do, before touching the server.
 *
 * Kept free of vscode types so the rules are testable on plain objects.
 */
export function planMoves(sources: MoveCandidate[], targetDir: MoveCandidate): MovePlan {
  if (sources.length === 0) {
    return { moves: [] };
  }

  if (sources.some(source => source.remoteId !== targetDir.remoteId)) {
    return {
      moves: [],
      rejection: 'Moving between different SFTP configurations is not supported.',
    };
  }

  // Dropping a folder onto itself or into its own subtree would move it out
  // from under the destination.
  const intoItself = sources.find(
    source => source.isDirectory && isRemotePathAtOrUnder(source.fsPath, targetDir.fsPath)
  );
  if (intoItself) {
    return {
      moves: [],
      rejection: `Can't move '${upath.basename(intoItself.fsPath)}' into itself.`,
    };
  }

  // If both a folder and something inside it were selected, only the folder
  // moves; the inner path stops existing as soon as it does.
  const outermost = sources.filter(
    source =>
      !sources.some(
        other =>
          other !== source &&
          other.isDirectory &&
          isRemotePathAtOrUnder(other.fsPath, source.fsPath)
      )
  );

  const moves: PlannedMove[] = [];
  for (const source of outermost) {
    const to = upath.join(targetDir.fsPath, upath.basename(source.fsPath));

    // Already sitting in the destination folder.
    if (to === source.fsPath) {
      continue;
    }

    moves.push({ from: source.fsPath, to, isDirectory: source.isDirectory });
  }

  return { moves };
}
