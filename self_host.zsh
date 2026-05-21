#!/usr/bin/env zsh
emulate -L zsh -o errexit -o nounset -o pipefail

readonly ROOT_DIR="${0:A:h}"
readonly STATE_DIR="$ROOT_DIR/.self_host"
readonly CONFIG_FILE="$STATE_DIR/config.env"
readonly RUN_APP_SCRIPT="$STATE_DIR/run_app.zsh"
readonly BIN_DIR="$STATE_DIR/bin"
readonly BIN_PATH="$BIN_DIR/longwave-server"
readonly LOG_DIR="$STATE_DIR/logs"
readonly APP_LOG="$LOG_DIR/app.log"
readonly LOCK_CHECKSUM_FILE="$STATE_DIR/pnpm-lock.sha256"
readonly CADDYFILE="${CADDYFILE:-$HOME/Caddyfile}"
readonly DEFAULT_PUBLIC_URL='https://wavelength.pinky.lilf.ir'
readonly DEFAULT_NODE_VERSION='20.20.0'
readonly DEFAULT_APP_PORT='3310'
readonly DEFAULT_ROOM_TTL='168h'
readonly APP_SESSION_NAME='longwave-app'
readonly CADDY_BEGIN='# BEGIN longwave self-host'
readonly CADDY_END='# END longwave self-host'

tmuxnew () {
	tmux kill-session -t "$1" &> /dev/null || true
	tmux new -d -s "$@"
}

usage() {
  cat <<USAGE
Usage: ./self_host.zsh [setup|redeploy|start|stop] [public_url]

setup     Stop any running Longwave session, install/build what is needed, update ~/Caddyfile, and start Longwave.
redeploy  Rebuild and restart Longwave from the current local checkout.
start     Start Longwave from existing artifacts and saved config. You may optionally pass a replacement public_url.
stop      Stop the tmux-managed Longwave app.

Default public_url: $DEFAULT_PUBLIC_URL
If public_url omits a scheme, http:// is assumed.
USAGE
}

die() {
  print -u2 -- "Error: $*"
  exit 1
}

note() {
  print -- "==> $*"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

copy_env_if_unset() {
  local target_name="$1"
  local source_name="$2"
  local source_value="${(P)source_name:-}"

  if [[ -z "${(P)target_name:-}" && -n "$source_value" ]]; then
    export "$target_name=$source_value"
  fi
}

load_proxy() {
  copy_env_if_unset http_proxy HTTP_PROXY
  copy_env_if_unset HTTP_PROXY http_proxy
  copy_env_if_unset https_proxy HTTPS_PROXY
  copy_env_if_unset HTTPS_PROXY https_proxy
  copy_env_if_unset all_proxy ALL_PROXY
  copy_env_if_unset ALL_PROXY all_proxy

  if [[ -z "${npm_config_proxy:-}" ]]; then
    local proxy_value="${https_proxy:-${HTTPS_PROXY:-${http_proxy:-${HTTP_PROXY:-}}}}"
    if [[ -n "$proxy_value" ]]; then
      export npm_config_proxy="$proxy_value"
    fi
  fi

  if [[ -z "${npm_config_https_proxy:-}" ]]; then
    local https_proxy_value="${https_proxy:-${HTTPS_PROXY:-${http_proxy:-${HTTP_PROXY:-}}}}"
    if [[ -n "$https_proxy_value" ]]; then
      export npm_config_https_proxy="$https_proxy_value"
    fi
  fi
}

ensure_prerequisites() {
  require_cmd tmux
  require_cmd caddy
  require_cmd curl
  require_cmd python3
  require_cmd sha256sum
  require_cmd ss
}

ensure_build_prerequisites() {
  require_cmd tmux
  require_cmd caddy
  require_cmd curl
  require_cmd gcc
  require_cmd go
  require_cmd pnpm
  require_cmd python3
  require_cmd sha256sum
  require_cmd ss
  zsh -lc 'source ~/.shared.sh >/dev/null 2>&1 || true; type nvm-load >/dev/null 2>&1' \
    || die 'nvm-load is required in zsh login shells'
}

ensure_dirs() {
  mkdir -p "$STATE_DIR" "$BIN_DIR" "$LOG_DIR" "$STATE_DIR/data"
}

bootstrap_node() {
  source ~/.shared.sh >/dev/null 2>&1 || true
  if ! command -v nvm-load >/dev/null 2>&1; then
    [[ -s "$HOME/.nvm_load" ]] && source "$HOME/.nvm_load"
    [[ -s "$HOME/.nvm/nvm.sh" ]] && source "$HOME/.nvm/nvm.sh"
  fi
  command -v nvm-load >/dev/null 2>&1 || die 'nvm-load is required in zsh shells'
  nvm-load >/dev/null 2>&1
  nvm use "$DEFAULT_NODE_VERSION" >/dev/null
}

normalize_public_url() {
  local raw_input="${1:-$DEFAULT_PUBLIC_URL}"
  python3 - "$raw_input" <<'PY'
import sys
from urllib.parse import urlparse

raw = sys.argv[1].strip()
if not raw:
    raise SystemExit('public_url must not be empty')
if '://' not in raw:
    raw = 'http://' + raw
parsed = urlparse(raw)
if parsed.scheme not in {'http', 'https'}:
    raise SystemExit('public_url must begin with http:// or https://')
if not parsed.netloc:
    raise SystemExit('public_url must include a hostname')
if parsed.path not in ('', '/'):
    raise SystemExit('public_url must not include a path')
if parsed.params or parsed.query or parsed.fragment:
    raise SystemExit('public_url must not include params, query, or fragment')
print(f'{parsed.scheme}://{parsed.netloc}')
PY
}

load_config() {
  [[ -f "$CONFIG_FILE" ]] || die "Missing config file: $CONFIG_FILE. Run ./self_host.zsh setup first."
  source "$CONFIG_FILE"
  [[ -n "${PUBLIC_URL:-}" ]] || die 'Saved config is missing PUBLIC_URL'
  [[ -n "${APP_PORT:-}" ]] || die 'Saved config is missing APP_PORT'
  [[ -n "${ROOM_TTL:-}" ]] || die 'Saved config is missing ROOM_TTL'
}

load_existing_config_if_present() {
  if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
  fi
}

persist_config() {
  local public_url="$1"
  local app_port="$2"
  local room_ttl="$3"

  ensure_dirs
  cat > "$CONFIG_FILE" <<EOF_CONFIG
PUBLIC_URL='${public_url}'
NODE_VERSION='${DEFAULT_NODE_VERSION}'
APP_PORT='${app_port}'
ROOM_TTL='${room_ttl}'
EOF_CONFIG
}

port_is_busy() {
  local port="$1"
  ss -ltn "( sport = :${port} )" | tail -n +2 | grep -q LISTEN
}

choose_free_port() {
  local candidate="$1"

  while port_is_busy "$candidate"; do
    candidate="$(( candidate + 1 ))"
  done

  print -r -- "$candidate"
}

resolve_public_url() {
  if [[ -n "${1:-}" ]]; then
    normalize_public_url "$1" || die 'Invalid public URL'
    return
  fi

  if [[ -f "$CONFIG_FILE" ]]; then
    load_config
    normalize_public_url "$PUBLIC_URL" || die 'Saved public URL is invalid'
    return
  fi

  normalize_public_url "$DEFAULT_PUBLIC_URL" || die 'Default public URL is invalid'
}

prepare_config_for_setup_like_command() {
  local requested_url="${1:-}"
  load_existing_config_if_present

  local public_url base_port room_ttl selected_port
  public_url="$(resolve_public_url "$requested_url")"
  base_port="$DEFAULT_APP_PORT"
  room_ttl="${ROOM_TTL:-$DEFAULT_ROOM_TTL}"
  selected_port="$(choose_free_port "$base_port")"

  persist_config "$public_url" "$selected_port" "$room_ttl"
}

prepare_config_for_start() {
  local requested_url="${1:-}"
  load_config

  if [[ -n "$requested_url" ]]; then
    persist_config "$(resolve_public_url "$requested_url")" "$APP_PORT" "$ROOM_TTL"
  fi
}

current_lock_checksum() {
  [[ -f "$ROOT_DIR/pnpm-lock.yaml" ]] || die 'Missing pnpm-lock.yaml'
  sha256sum "$ROOT_DIR/pnpm-lock.yaml" | awk '{print $1}'
}

run_in_node_shell() {
  local command_string="$1"
  zsh -lc "source ~/.shared.sh >/dev/null 2>&1 || true; nvm-load >/dev/null 2>&1; nvm use ${(q)DEFAULT_NODE_VERSION} >/dev/null; cd ${(q)ROOT_DIR}; ${command_string}"
}

install_dependencies_if_needed() {
  local new_checksum existing_checksum=''
  new_checksum="$(current_lock_checksum)"
  if [[ -f "$LOCK_CHECKSUM_FILE" ]]; then
    existing_checksum="$(<"$LOCK_CHECKSUM_FILE")"
  fi

  if [[ ! -d "$ROOT_DIR/node_modules" || "$new_checksum" != "$existing_checksum" ]]; then
    note 'Installing pnpm dependencies...'
    load_proxy
    run_in_node_shell 'pnpm install --frozen-lockfile --prefer-offline --reporter append-only --network-concurrency 1 --fetch-retries 20 --fetch-retry-factor 2 --fetch-retry-mintimeout 2000 --fetch-retry-maxtimeout 120000'
    print -- "$new_checksum" > "$LOCK_CHECKSUM_FILE"
  else
    note 'pnpm dependencies already match pnpm-lock.yaml; skipping install.'
  fi
}

build_frontend() {
  note 'Building frontend bundle...'
  load_proxy
  run_in_node_shell 'pnpm build'
}

build_backend() {
  note 'Building Go backend...'
  load_proxy
  (
    cd "$ROOT_DIR"
    GOTOOLCHAIN=local go build -o "$BIN_PATH" ./server/cmd/longwave-server
  )
}

write_run_app_script() {
  load_config
  cat > "$RUN_APP_SCRIPT" <<EOF_RUN
#!/usr/bin/env zsh
emulate -L zsh -o errexit -o nounset -o pipefail

readonly ROOT_DIR='${ROOT_DIR}'
readonly CONFIG_FILE='${CONFIG_FILE}'
readonly APP_LOG='${APP_LOG}'
readonly BIN_PATH='${BIN_PATH}'

source "\$CONFIG_FILE"
mkdir -p "\${APP_LOG:h}" "\$ROOT_DIR/.self_host/data"
cd "\$ROOT_DIR"

export LONGWAVE_ADDR="127.0.0.1:\$APP_PORT"
export LONGWAVE_BUILD_DIR="\$ROOT_DIR/build"
export LONGWAVE_DB_PATH="\$ROOT_DIR/.self_host/data/rooms.sqlite"
export LONGWAVE_ROOM_TTL="\$ROOM_TTL"

"\$BIN_PATH" 2>&1 | tee -a "\$APP_LOG"
EOF_RUN
  chmod +x "$RUN_APP_SCRIPT"
}

render_caddy_block() {
  load_config
  python3 - "$PUBLIC_URL" "$APP_PORT" <<'PY'
import sys
from urllib.parse import urlparse

public_url, app_port = sys.argv[1:3]
parsed = urlparse(public_url)
host = parsed.netloc

common = f"""    encode zstd gzip\n    reverse_proxy 127.0.0.1:{app_port}\n"""

blocks = []
if parsed.scheme == 'https':
    blocks.append(f"https://{host} {{\n    tls internal\n{common}}}")
    blocks.append(f"http://{host} {{\n{common}}}")
else:
    blocks.append(f"http://{host} {{\n{common}}}")

print('\n\n'.join(blocks))
PY
}

update_caddyfile() {
  [[ -f "$CADDYFILE" ]] || touch "$CADDYFILE"
  local candidate="$STATE_DIR/Caddyfile.candidate"
  local block_contents
  block_contents="$(render_caddy_block)"

  TARGET_CADDYFILE="$CADDYFILE" BLOCK_BEGIN="$CADDY_BEGIN" BLOCK_END="$CADDY_END" BLOCK_CONTENTS="$block_contents" OUTPUT_PATH="$candidate" python3 - <<'PY'
import os
import pathlib
import re

caddyfile = pathlib.Path(os.environ['TARGET_CADDYFILE'])
text = caddyfile.read_text() if caddyfile.exists() else ''
begin = os.environ['BLOCK_BEGIN']
end = os.environ['BLOCK_END']
block = begin + '\n' + os.environ['BLOCK_CONTENTS'].rstrip() + '\n' + end + '\n'
pattern = re.compile(re.escape(begin) + r'.*?' + re.escape(end) + r'\n?', re.S)
if pattern.search(text):
    updated = pattern.sub(block, text)
else:
    updated = text.rstrip() + ('\n\n' if text.strip() else '') + block
pathlib.Path(os.environ['OUTPUT_PATH']).write_text(updated)
PY

  caddy validate --config "$candidate" --adapter caddyfile >/dev/null
  cp "$candidate" "$CADDYFILE"
  caddy reload --config "$CADDYFILE" --adapter caddyfile >/dev/null
}

ensure_runtime_artifacts() {
  [[ -x "$BIN_PATH" ]] || die "Missing backend binary: $BIN_PATH"
  [[ -x "$RUN_APP_SCRIPT" ]] || die "Missing run script: $RUN_APP_SCRIPT"
  [[ -f "$ROOT_DIR/build/index.html" ]] || die 'Missing frontend build output. Run ./self_host.zsh redeploy first.'
}

wait_for_healthz() {
  load_config
  local attempt
  for attempt in {1..30}; do
    if curl --silent --fail --noproxy '*' --connect-timeout 1 --max-time 2 \
      "http://127.0.0.1:${APP_PORT}/healthz" >/dev/null; then
      return 0
    fi
    sleep 1
  done

  die "Longwave did not become healthy on port ${APP_PORT}; inspect $APP_LOG or tmux attach -t $APP_SESSION_NAME"
}

start_app() {
  load_config
  ensure_runtime_artifacts
  if port_is_busy "$APP_PORT"; then
    die "Port ${APP_PORT} is already in use; stop the conflicting process or rerun setup/redeploy to choose a new port."
  fi

  note "Starting Longwave on 127.0.0.1:${APP_PORT}..."
  tmuxnew "$APP_SESSION_NAME" "$RUN_APP_SCRIPT"
  wait_for_healthz
}

stop_app() {
  tmux kill-session -t "$APP_SESSION_NAME" &> /dev/null || true
}

setup_command() {
  local requested_url="${1:-}"
  stop_app
  prepare_config_for_setup_like_command "$requested_url"
  install_dependencies_if_needed
  build_frontend
  build_backend
  write_run_app_script
  update_caddyfile
  start_app
  load_config
  note "Longwave is configured for $PUBLIC_URL"
}

redeploy_command() {
  local requested_url="${1:-}"
  stop_app
  prepare_config_for_setup_like_command "$requested_url"
  install_dependencies_if_needed
  build_frontend
  build_backend
  write_run_app_script
  update_caddyfile
  start_app
  load_config
  note "Longwave redeployed from the current local checkout for $PUBLIC_URL"
}

start_command() {
  local requested_url="${1:-}"
  prepare_config_for_start "$requested_url"
  write_run_app_script
  update_caddyfile
  start_app
  load_config
  note "Longwave started for $PUBLIC_URL"
}

main() {
  local command="${1:-}"
  local public_url="${2:-}"

  case "$command" in
    setup)
      ensure_prerequisites
      ensure_build_prerequisites
      ensure_dirs
      bootstrap_node
      setup_command "$public_url"
      ;;
    redeploy)
      ensure_prerequisites
      ensure_build_prerequisites
      ensure_dirs
      bootstrap_node
      redeploy_command "$public_url"
      ;;
    start)
      ensure_prerequisites
      ensure_dirs
      start_command "$public_url"
      ;;
    stop)
      require_cmd tmux
      stop_app
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
