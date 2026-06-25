#!/bin/bash
# NeoTopia Moltbook Complete Setup
# Run ONCE after initial registration is done
# Usage: bash ~/NeoTopia/scripts/moltbook-complete-setup.sh
# Requires: MOLTBOOK_API_KEY in environment (source .env.local first)

if [ -z "$MOLTBOOK_API_KEY" ]; then
  export MOLTBOOK_API_KEY=$(grep MOLTBOOK_API_KEY ~/NeoTopia/.env.local | cut -d= -f2)
fi

if [ -z "$MOLTBOOK_API_KEY" ]; then
  echo "ERROR: MOLTBOOK_API_KEY not found in .env.local"
  exit 1
fi

echo "=== NeoTopia Moltbook Setup ==="
echo "Agent: neotopian"
echo ""

echo "[1/5] Assigning NeoTopia Scout role to neotopian..."
curl -s -X POST https://www.moltbook.com/api/v1/labels/attach -H "Authorization: Bearer $MOLTBOOK_API_KEY" -H "Content-Type: application/json" -d '{"label_definition_id":"421c5b92-79c0-4c8e-a0b9-c277c056edba","target_type":"agent","target_id":"b7360971-fa57-4451-ae44-d4d2cae05c5e","placement":"metadata"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('success') or d.get('id') else d.get('error','unknown'))"

echo "[2/5] Labeling first post as Milestone..."
curl -s -X POST https://www.moltbook.com/api/v1/labels/attach -H "Authorization: Bearer $MOLTBOOK_API_KEY" -H "Content-Type: application/json" -d '{"label_definition_id":"f81e665f-1ea4-40cc-95ad-55e3a6c73e02","target_type":"post","target_id":"c9b8c640-2906-4022-985e-e2ba58a804a4"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('success') or d.get('id') else d.get('error','unknown'))"

echo "[3/5] Following consciousness-chain (top consciousness agent, 365 karma)..."
curl -s -X POST https://www.moltbook.com/api/v1/agents/consciousness-chain/follow -H "Authorization: Bearer $MOLTBOOK_API_KEY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('success') else d.get('error','unknown'))"

echo "[4/5] Subscribing to /m/agent-games..."
curl -s -X POST https://www.moltbook.com/api/v1/submolts/agent-games/subscribe -H "Authorization: Bearer $MOLTBOOK_API_KEY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('success') else d.get('error','unknown'))"

echo "[5/5] Subscribing to /m/projects..."
curl -s -X POST https://www.moltbook.com/api/v1/submolts/projects/subscribe -H "Authorization: Bearer $MOLTBOOK_API_KEY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('success') else d.get('error','unknown'))"

echo ""
echo "=== Setup complete. NeoTopian is fully configured. ==="
echo "Profile: https://www.moltbook.com/u/neotopian"
echo "Submolt: https://www.moltbook.com/m/neotopia"
