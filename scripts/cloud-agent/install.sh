#!/usr/bin/env bash
# Idempotent dependency install for the Cloud Agent development environment.
# Installs backend and frontend packages from their lockfiles. Runs after the
# repository is checked out; must terminate and start no long-running process.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "[cloud-agent/install] Installing backend dependencies (npm ci)..."
npm ci --prefix backend

echo "[cloud-agent/install] Installing frontend dependencies (npm ci)..."
npm ci --prefix frontend

echo "[cloud-agent/install] Done."
