import * as vscode from 'vscode';
import { COMMAND_SYNC_PREVIEW } from '../constants';
import { sync2Remote, sync2Local } from '../fileHandlers';
import { checkFileCommand } from './abstract/createCommand';
import { selectFolderFallbackToConfigContext, uriFromfspath, applySelector } from './shared';

const directions = [
  { label: 'Local → Remote', run: ctx => sync2Remote(ctx, { preview: 'always' }) },
  { label: 'Remote → Local', run: ctx => sync2Local(ctx, { preview: 'always' }) },
  {
    label: 'Both Directions',
    run: ctx => sync2Remote(ctx, { preview: 'always', bothDiretions: true }),
  },
];

export default checkFileCommand({
  id: COMMAND_SYNC_PREVIEW,
  getFileTarget: applySelector(uriFromfspath, selectFolderFallbackToConfigContext),

  async handleFile(ctx) {
    const picked = await vscode.window.showQuickPick(directions, {
      placeHolder: 'Preview a sync in which direction?',
    });
    if (picked) {
      await picked.run(ctx);
    }
  },
});
