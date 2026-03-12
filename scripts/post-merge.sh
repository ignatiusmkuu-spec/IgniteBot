#!/bin/bash
set -e
echo "=== Post-merge setup ==="
cd /home/runner/workspace

echo "Installing npm dependencies..."
npm install --no-audit --prefer-offline 2>&1 || npm install --no-audit 2>&1

echo "=== Post-merge setup complete ==="
