#!/usr/bin/env bash
# Per-boot startup for the Cloud Agent development environment.
#
# Brings up BOTH apps on localhost so the stack can be tested end to end with
# the injected Supabase / R2 secrets:
#   - backend (Express API)  -> http://localhost:3001
#   - frontend (Next.js app) -> http://localhost:3000
#
# The saved environment secrets point FRONTEND_URL and NEXT_PUBLIC_API_BASE_URL
# at the deployed production URLs. Both dotenv (backend) and Next.js let real
# shell environment variables win over .env files, so we EXPORT localhost values
# here before launching; that guarantees the frontend talks to the LOCAL backend
# instead of production, while Supabase/R2/etc. keep using the provided secrets.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

BACKEND_PORT=3001
FRONTEND_PORT=3000
LOG_DIR="$REPO_ROOT/.cloud-agent-logs"
mkdir -p "$LOG_DIR"

# ---------------------------------------------------------------------------
# 1. Force localhost wiring (authoritative over injected production URLs).
#    NOTE: do NOT export PORT globally — `next dev` also honors PORT and would
#    bind the frontend to the backend's port. PORT is passed inline to the
#    backend only, and the frontend gets an explicit `-p ${FRONTEND_PORT}`.
# ---------------------------------------------------------------------------
unset PORT
export FRONTEND_URL="http://localhost:${FRONTEND_PORT}"
export NEXT_PUBLIC_API_BASE_URL="http://localhost:${BACKEND_PORT}"

# ---------------------------------------------------------------------------
# 2. Materialize .env files so manual `npm run dev` and docs stay consistent.
#    Secrets come from the already-injected environment; nothing is hardcoded.
# ---------------------------------------------------------------------------
write_env_line() {
  # write_env_line <file> <KEY> <value>; skips empty values.
  local file="$1" key="$2" value="$3"
  [ -n "$value" ] && printf '%s=%s\n' "$key" "$value" >>"$file"
}

BACKEND_ENV="$REPO_ROOT/backend/.env"
: >"$BACKEND_ENV"
write_env_line "$BACKEND_ENV" PORT "$BACKEND_PORT"
write_env_line "$BACKEND_ENV" FRONTEND_URL "http://localhost:${FRONTEND_PORT}"
write_env_line "$BACKEND_ENV" DOWNLOAD_SIGNING_SECRET "${DOWNLOAD_SIGNING_SECRET:-}"
write_env_line "$BACKEND_ENV" SUPABASE_URL "${SUPABASE_URL:-}"
write_env_line "$BACKEND_ENV" SUPABASE_SECRET_KEY "${SUPABASE_SECRET_KEY:-}"
write_env_line "$BACKEND_ENV" R2_ENDPOINT_URL "${R2_ENDPOINT_URL:-}"
write_env_line "$BACKEND_ENV" R2_ACCESS_KEY_ID "${R2_ACCESS_KEY_ID:-}"
write_env_line "$BACKEND_ENV" R2_SECRET_ACCESS_KEY "${R2_SECRET_ACCESS_KEY:-}"
write_env_line "$BACKEND_ENV" R2_BUCKET_NAME "${R2_BUCKET_NAME:-}"
write_env_line "$BACKEND_ENV" USER_API_KEYS_ENCRYPTION_SECRET "${USER_API_KEYS_ENCRYPTION_SECRET:-}"
write_env_line "$BACKEND_ENV" COURTLISTENER_BULK_DATA_ENABLED "${COURTLISTENER_BULK_DATA_ENABLED:-false}"
# Optional model / integration keys: only written when provided.
write_env_line "$BACKEND_ENV" GEMINI_API_KEY "${GEMINI_API_KEY:-}"
write_env_line "$BACKEND_ENV" ANTHROPIC_API_KEY "${ANTHROPIC_API_KEY:-}"
write_env_line "$BACKEND_ENV" OPENAI_API_KEY "${OPENAI_API_KEY:-}"
write_env_line "$BACKEND_ENV" RESEND_API_KEY "${RESEND_API_KEY:-}"
write_env_line "$BACKEND_ENV" COURTLISTENER_API_TOKEN "${COURTLISTENER_API_TOKEN:-}"

FRONTEND_ENV="$REPO_ROOT/frontend/.env.local"
: >"$FRONTEND_ENV"
write_env_line "$FRONTEND_ENV" NEXT_PUBLIC_SUPABASE_URL "${NEXT_PUBLIC_SUPABASE_URL:-}"
write_env_line "$FRONTEND_ENV" NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY "${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY:-}"
write_env_line "$FRONTEND_ENV" NEXT_PUBLIC_API_BASE_URL "http://localhost:${BACKEND_PORT}"

echo "[cloud-agent/start] Wrote backend/.env and frontend/.env.local (localhost wiring)."

# ---------------------------------------------------------------------------
# 3. Free the dev ports so restarts are idempotent (kill only those PIDs).
# ---------------------------------------------------------------------------
free_port() {
  local port="$1" pids
  pids="$(lsof -ti "tcp:${port}" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "[cloud-agent/start] Freeing port ${port} (pids: ${pids})."
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 2
    pids="$(lsof -ti "tcp:${port}" 2>/dev/null || true)"
    # shellcheck disable=SC2086
    [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
  fi
}
free_port "$BACKEND_PORT"
free_port "$FRONTEND_PORT"

# ---------------------------------------------------------------------------
# 4. Launch both dev servers in the background with log files.
# ---------------------------------------------------------------------------
echo "[cloud-agent/start] Starting backend on :${BACKEND_PORT} ..."
( cd "$REPO_ROOT" && PORT="$BACKEND_PORT" npm run dev --prefix backend ) >"$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

echo "[cloud-agent/start] Starting frontend on :${FRONTEND_PORT} ..."
( cd "$REPO_ROOT" && npm run dev --prefix frontend -- -p "$FRONTEND_PORT" ) >"$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

# ---------------------------------------------------------------------------
# 5. Wait for readiness so a failed boot surfaces clearly.
# ---------------------------------------------------------------------------
wait_for() {
  local name="$1" url="$2" tries=60
  for ((i = 1; i <= tries; i++)); do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then
      echo "[cloud-agent/start] ${name} is ready at ${url}"
      return 0
    fi
    sleep 2
  done
  echo "[cloud-agent/start] ERROR: ${name} did not become ready at ${url}" >&2
  return 1
}

READY=0
wait_for "backend" "http://localhost:${BACKEND_PORT}/health" || READY=1
wait_for "frontend" "http://localhost:${FRONTEND_PORT}" || READY=1

if [ "$READY" -ne 0 ]; then
  echo "[cloud-agent/start] --- backend.log (tail) ---" >&2
  tail -n 40 "$LOG_DIR/backend.log" >&2 || true
  echo "[cloud-agent/start] --- frontend.log (tail) ---" >&2
  tail -n 40 "$LOG_DIR/frontend.log" >&2 || true
  exit 1
fi

echo "[cloud-agent/start] Both services are up:"
echo "  backend : http://localhost:${BACKEND_PORT} (health: /health)"
echo "  frontend: http://localhost:${FRONTEND_PORT}"

# ---------------------------------------------------------------------------
# 6. Stay attached so the dev servers keep running for the life of the boot.
# ---------------------------------------------------------------------------
wait "$BACKEND_PID" "$FRONTEND_PID"
