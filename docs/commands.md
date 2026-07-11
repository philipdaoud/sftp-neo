# Common commands

## Remote Explorer Filter

The **Remote Explorer Filter** lets you quickly narrow down the files and folders shown in the Remote Explorer sidebar.

### How it works

1. Click the **filter** icon (funnel) in the Remote Explorer title bar, or run **SFTP: Filter Remote Explorer** from the Command Palette.
2. Start typing in the filter box. The Remote Explorer updates live as you type.
3. Only files and folders whose names include the typed text remain visible.
4. Parent folders stay visible if they contain a matching file or folder, so a deep match (for example `src/components/Button.tsx`) keeps the whole path visible.
5. Click the **X** icon in the title bar, run **SFTP: Clear Remote Explorer Filter**, or clear the filter text and press `Enter` to show all items again.

### Important: client-side, visible items only

The filter is **purely client-side**. It filters only the files and folders that are **already displayed in the Remote Explorer** (i.e., already fetched and visible/expanded). It does **not** search the remote server, request additional directory listings, or reveal files that have not been loaded yet.

### Examples

| You type | What you see |
|----------|--------------|
| `index` | Any file or folder whose name contains `index` |
| `button` | `Button.tsx`, `Button.test.tsx`, and the folders that contain them |
| *(empty)* | The full, unfiltered tree |

## SFTP: Filter Remote Explorer
Open the live filter input for the Remote Explorer. Type to filter the files and folders currently shown in the sidebar.

## SFTP: Clear Remote Explorer Filter
Remove the active Remote Explorer filter and restore the full tree.

## SFTP: Config
Create a new configuration file for a project.

## SFTP: Set Profile
Set the current profile.
           
### KeyBindings Args
func(profileName: string)

## SFTP: Upload Active File
Upload the current file.

## SFTP: Upload Changed Files
Upload all files changed or created since the last commit to your Git.
Can be called by default keyboard shortcut `Ctrl+Alt+U`.

## SFTP: Upload Active Folder
Upload the entire folder the current file is located in.

## SFTP: Download Active File
Download the remote version of the current file and overwrite the local copy.

## SFTP: Download Active Folder
Download the entire folder the current file is located in.

## SFTP: Sync Local -> Remote
1. Any files that exist on both local and remote that have a different timestamp between local and remote are copied over.
2. Any files that only exist on the local are copied over.

You can change the default behavior by [syncOption](https://github.com/philipdaoud/sftp-neo/wiki/Configuration#syncoption).

## SFTP: Sync Remote -> Local
Same as `Sync Local -> Remote`, but in the opposite direction.

## SFTP: Sync Both Directions
Compare file modification times, and will always perform the action that causes the newest file to be present in both locations.

*Only [skipCreate](https://github.com/philipdaoud/sftp-neo/wiki/Configuration#syncoptionskipcreate) and [ignoreExisting](https://github.com/philipdaoud/sftp-neo/wiki/Configuration#syncoptionignoreexisting) are valid for this command.*

## SFTP: List Active Folder
List the folder the current file is located in.

## sftp.upload
Upload file or folders.

### KeyBindings Args
func(fspaths: string[])

## sftp.download
Download file or folders.

### KeyBindings Args
func(fspaths: string[])

## SFTP: Cancel All Transfers
Stop the current transfers (upload and download).

## SFTP: Open SSH in Terminal
Open a terminal in VSCode and auto login to a specific server.

***

# Alt commands
An alternative command can be found when pressing `Alt` while opening a menu.

## Force Download
Download file but disregard ignore rules.

## Force Upload
Upload file but disregard ignore rules.
