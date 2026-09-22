#!/bin/bash
# One-time helper to push stitchpure to GitHub with a Personal Access Token.
# The token is read silently (never printed, never stored in history).
#
# Usage:  bash scripts/push-to-github.sh
#
# You need a token with write access:
#   Classic: https://github.com/settings/tokens/new  -> tick the whole "repo" scope
#   Fine-grained: repo = stitchpure/stitchpure, Contents = Read and write

set -e

REPO="stitchpure/stitchpure"
USER="stitchpure"

echo "Paste your GitHub Personal Access Token (input hidden), then press Enter:"
read -rs TOKEN
echo

if [ -z "$TOKEN" ]; then
  echo "No token entered. Aborting."
  exit 1
fi

echo "→ Checking who this token belongs to..."
LOGIN=$(curl -s -H "Authorization: token $TOKEN" https://api.github.com/user | grep '"login"' | head -1 | cut -d'"' -f4)
if [ -z "$LOGIN" ]; then
  echo "✗ Token is invalid or expired (GitHub did not recognise it)."
  exit 1
fi
echo "  Token belongs to: $LOGIN"

echo "→ Checking write access to $REPO..."
CAN_PUSH=$(curl -s -H "Authorization: token $TOKEN" "https://api.github.com/repos/$REPO" | grep -A5 '"permissions"' | grep '"push"' | grep -c true || true)
if [ "$CAN_PUSH" != "1" ]; then
  echo "✗ This token does NOT have push (write) access to $REPO."
  echo "  Fix: create a token with the full 'repo' scope (classic) OR"
  echo "       Contents = Read and write (fine-grained) for $REPO, then run again."
  exit 1
fi
echo "  ✓ Write access confirmed."

echo "→ Pushing main → $REPO ..."
git push "https://${USER}:${TOKEN}@github.com/${REPO}.git" main:main

echo
echo "✓ Done. Your code is now on https://github.com/$REPO"
echo "Note: revoke this token afterwards if it was ever shared."
