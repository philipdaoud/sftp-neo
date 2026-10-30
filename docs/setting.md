# Setting

There are a handful of settings available for SFTP, and they can be changed:

- On Windows/Linux: File --> Preferences --> Settings
- On macOS: Code --> Preferences --> Settings

## debug
*boolean*: Adds debugging output to the SFTP output panel.
You can view the login in `View --> Output --> SFTP`.  Changing this requires VSCode to be reloaded.

**default**: false

## downloadWhenOpenInRemoteExplorer
*boolean*: Change the default behavior from `View Content` to `Edit in Local` when opening files in the Remote Explorer.

**default**: false

## skipHostKeyVerification
*string[]*: **Insecure.** Hosts whose SSH host key is accepted without any check,
for disposable test servers (containers, VMs, staging) that get a new key on
every rebuild. For these hosts:

- any key is accepted, whether unknown or changed, with no prompt;
- nothing is written to `~/.vscode-sftp/known_hosts.json`;
- a warning with the received fingerprint is logged to the SFTP output channel
  on every connection.

Entries are hostnames or IP addresses as SFTP Neo connects to them (the
`HostName`, not an SSH config alias). They are case-insensitive, may use `*` and
`?` wildcards, and may end in `:port` (`[addr]:port` for IPv6):

```json
"sftp.skipHostKeyVerification": ["staging.test", "*.lab.local", "10.0.0.5:2222"]
```

A bare `*` (or any wildcard-only entry) is ignored, so the list must name hosts.
The setting is machine-scoped: it can only be set in **User** settings (or
Remote settings), never in workspace settings or `sftp.json`, and Settings Sync
does not copy it to other machines. Never list production servers: a
man-in-the-middle would go unnoticed.

**default**: []
