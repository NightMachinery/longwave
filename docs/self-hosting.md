# Self-hosting Longwave

Longwave now ships with a tmux-based self-host flow for intranet deployments. It does **not** use Docker.

Use:

```zsh
./self_host.zsh [setup|redeploy|start|stop] [public_url]
```

Default public URL:

```text
http://wavelength.pinky.lilf.ir
```

If `public_url` omits a scheme, `http://` is assumed.

## What it manages

- installs frontend dependencies with `pnpm` using the committed `pnpm-lock.yaml`
- builds the React frontend with Node `20.20.0`
- builds the local Go backend that replaces Firebase for room sync
- stores room state in local SQLite with a 7-day idle TTL
- serves the SPA, API, and SSE room updates from the same local backend
- runs the backend in tmux as `longwave-app`
- inserts or updates a bounded Longwave block in `~/Caddyfile`
- validates and reloads Caddy after config changes

The self-host flow is intranet-friendly:

- no Firebase dependency
- no Google/captcha requirement
- no CDN-hosted runtime assets
- copy-invite-link works over plain `http://` with a browser fallback when `navigator.clipboard` is unavailable

## Requirements

Install and have available on this machine:

- `tmux`
- `caddy`
- `curl`
- `gcc` (required by the SQLite Go driver during `go build`)
- `go`
- `pnpm`
- `python3`
- `sha256sum`
- `ss`
- `nvm-load` in a zsh login shell

The script uses:

```zsh
nvm-load
nvm use 20.20.0
```

If package downloads need a proxy, export the usual proxy environment variables **before** running the script. The script does not hardcode the proxy; it only passes through the proxy environment already present in your shell.
Local health checks to `127.0.0.1` bypass the proxy automatically.

## Commands

### `setup [public_url]`

`setup` always:

1. stops any running `longwave-app` tmux session
2. normalizes and persists the public URL in `.self_host/config.env`
3. chooses the first free internal port starting at `3310`
4. installs dependencies if `pnpm-lock.yaml` changed or `node_modules` is missing
5. builds the frontend and Go backend
6. updates the managed Longwave block in `~/Caddyfile`
7. validates and reloads Caddy
8. starts Longwave in tmux and waits for `/healthz`

Examples:

```zsh
./self_host.zsh setup
./self_host.zsh setup wavelength.pinky.lilf.ir
./self_host.zsh setup http://games.internal
./self_host.zsh setup https://games.internal
```

### `redeploy [public_url]`

Rebuilds and restarts Longwave from the **current local checkout**. It does **not** pull from git.

Examples:

```zsh
./self_host.zsh redeploy
./self_host.zsh redeploy http://wavelength.pinky.lilf.ir
```

### `start [public_url]`

Starts the saved self-host configuration without rebuilding. You may optionally pass a replacement `public_url`, which rewrites the managed Caddy block before starting.

Examples:

```zsh
./self_host.zsh start
./self_host.zsh start http://wavelength.pinky.lilf.ir
```

### `stop`

Stops the tmux-managed Longwave app:

```zsh
./self_host.zsh stop
```

## Persisted local state

Self-host state lives under:

```text
.self_host/
```

Important files:

- `.self_host/config.env`
- `.self_host/run_app.zsh`
- `.self_host/bin/longwave-server`
- `.self_host/data/rooms.sqlite`
- `.self_host/logs/app.log`

Saved config values:

- `PUBLIC_URL`
- `NODE_VERSION`
- `APP_PORT`
- `ROOM_TTL`

## Port handling

- preferred internal app port: `3310`
- during `setup` and `redeploy`, the script checks from `3310` upward and saves the first free app port
- `start` expects the saved port to be free and fails fast if something else is already listening on it

Useful command:

```zsh
ss -ltnp
```

## Caddy integration

The script manages only the block between:

```text
# BEGIN longwave self-host
# END longwave self-host
```

in:

```text
~/Caddyfile
```

For an `http://...` public URL, the managed block reverse proxies that HTTP origin to the internal app port.

For an `https://...` public URL, the script writes:

- one `https://...` block with `tls internal`
- one matching `http://...` block without redirecting away from HTTP

That keeps the site usable over plain HTTP when needed.

## Runtime behavior

- The backend serves the built SPA and exposes `/healthz`.
- Room state is persisted in SQLite and shared over same-origin HTTP + SSE.
- Rooms expire after 7 days of inactivity.
- `PATCH /api/rooms/:roomId` uses a shallow top-level merge, matching the existing client update pattern.

## Logs and debugging

Useful commands:

```zsh
tmux ls
tmux attach -t longwave-app
tail -f .self_host/logs/app.log
sed -n '/BEGIN longwave self-host/,/END longwave self-host/p' ~/Caddyfile
```

Detach from tmux with `Ctrl-b` then `d`.
