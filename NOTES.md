# Operating notes

Handy commands for running this bot on the host.

## Logs

The bot writes its own logs rather than using stdout, so `pm2 logs` is usually
empty and these are the files to read. Both are truncated on every restart.

```bash
cat normalStdout.txt              # bot log
cat errStdErr.txt                 # bot error log
cat ~/.pm2/logs/timezone-error.log  # pm2-level errors (crashes, startup failures)
```

## Data

```bash
cat data.json                     # who has set which timezone
cat config.json                   # token + API keys (gitignored, never commit)
```

## Process

The pm2 app is named `timezone` and the entry point is `timezone.js`.

```bash
pm2 start ecosystem.config.js     # or: pm2 start timezone.js --name timezone
pm2 restart timezone
pm2 stop timezone
pm2 save                          # persist across reboots
```

## Google API key

The Geocoding call is server-side, so the key must use an **IP address**
application restriction, not an HTTP referrer one — referrer-restricted keys are
rejected with `REQUEST_DENIED ... cannot be used with this API`, which breaks
`set <city>` while leaving `set <IANA/Zone>` working.
