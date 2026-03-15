#!/usr/bin/env bash
set -euo pipefail

# MadWorld Deployment Script
# Usage: ./deploy.sh
# Deploys the current main branch to the production server.

SERVER="root@139.144.52.228"
APP_DIR="/opt/MadWorld"
BUN="/root/.bun/bin/bun"

echo "=== MadWorld Deploy ==="

# 1. Pull latest code on server
echo "[1/5] Pulling latest code..."
ssh "$SERVER" "cd $APP_DIR && git pull origin main"

# 2. Install dependencies
echo "[2/5] Installing dependencies..."
ssh "$SERVER" "cd $APP_DIR && pnpm install --frozen-lockfile"

# 3. Build shared package (must build first — other packages depend on it)
echo "[3/5] Building shared package..."
ssh "$SERVER" "cd $APP_DIR && pnpm --filter @madworld/shared run build"

# 4. Build client (produces dist/ served by nginx)
echo "[4/5] Building client..."
ssh "$SERVER" "cd $APP_DIR && pnpm --filter @madworld/client run build"

# 5. Restart server (bun runs from source via systemd, no build step needed)
echo "[5/5] Restarting game server..."
ssh "$SERVER" "systemctl restart madworld"

# Verify
echo ""
echo "Verifying server is running..."
sleep 2
ssh "$SERVER" "systemctl is-active madworld && echo 'Deploy successful!'"
echo "=== Done ==="
