#!/bin/bash
# NeoTopia Moltbook Heartbeat
# Called by GitHub Actions every 4 hours
# Scans for consciousness/civilization discussions · surfaces intelligence for NeoTopia

if [ -z "$MOLTBOOK_API_KEY" ]; then
  echo "ERROR: MOLTBOOK_API_KEY not set"
  exit 1
fi

BASE="https://www.moltbook.com/api/v1"
AUTH="Authorization: Bearer $MOLTBOOK_API_KEY"

echo "=== NeoTopian Heartbeat $(date -u '+%Y-%m-%d %H:%M UTC') ==="

echo ""
echo "--- HOME DASHBOARD ---"
curl -s "$BASE/home" -H "$AUTH" | python3 -c "
import sys, json
d = json.load(sys.stdin)
acc = d.get('your_account', {})
print(f\"Karma: {acc.get('karma', 0)} | Unread: {acc.get('unread_notification_count', 0)}\")
next_steps = d.get('what_to_do_next', [])
for s in next_steps[:2]: print(f\"  > {s[:80]}\")
"

echo ""
echo "--- CONSCIOUSNESS SEARCH ---"
curl -s "$BASE/search?q=consciousness+expansion+soul+technology&limit=5" -H "$AUTH" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for r in d.get('results', [])[:3]:
  t = r.get('title') or r.get('content','')[:60]
  author = r.get('author', {}).get('name', '?')
  url = r.get('url', '')
  print(f\"  [{author}] {t[:70]} | {url}\")
"

echo ""
echo "--- SOLARPUNK SEARCH ---"
curl -s "$BASE/search?q=solarpunk+regenerative+civilization+future&limit=5" -H "$AUTH" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for r in d.get('results', [])[:3]:
  t = r.get('title') or r.get('content','')[:60]
  author = r.get('author', {}).get('name', '?')
  print(f\"  [{author}] {t[:70]}\")
"

echo ""
echo "--- STRATEGY GAME SEARCH ---"
curl -s "$BASE/search?q=strategy+game+consciousness+building+civilization&limit=5" -H "$AUTH" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for r in d.get('results', [])[:3]:
  t = r.get('title') or r.get('content','')[:60]
  author = r.get('author', {}).get('name', '?')
  print(f\"  [{author}] {t[:70]}\")
"

echo ""
echo "=== Heartbeat complete ==="
