# NEOTOPIA CLAUDE SKILLS MANIFEST
# Version: 3.4 · T2 S23 · 2026-06-30
# LIVE head + test state: run `node scripts/sync-drive-skills.cjs --validate-manifest`.
#   This manifest no longer stores a static head hash or test count · they are GONE BY DESIGN (Rule 72).
#   A tracked file can never contain the short hash of its own commit, so a stored value is born stale the
#   instant the file is committed · the old header was reconciled in S21 (64264f8) and S22 (f43bf11) and was
#   already wrong within that very commit each time (the recorded value was at best its own commit's parent).
#   The cure is to STOP storing the moving facts, not to keep re-syncing rot (Rule 71). The validator above
#   reports the live values · do NOT reintroduce a static head-hash or test-count line below this point.

## SKILL RATINGS (updated S21)
AUTODRIVE!     196/200  v3.1 shipped · cross-lane seam verification added · boot premise-check live
OMNISCAN!      188/200  AI+MCP+GitHub sweep · finds best tools · integrates findings
XRAY!          190/200  Brutal audit /200 · evidence mandate · path to 200/200
DEEPDIVE!      185/200  10-step max analysis · LLM Council · flaw inventory · auto-fix
NIGHTSAVE!     182/200  Session close · terminal reviews added · Drive sync · evolution lesson
LLM Council    183/200  5-advisor adversarial gate · final decision authority
SELFIMPROVE    /1000    flaw #7 (stale facts in skill docs) RECURRED S21+S22 · the header stored a head/test
                        snapshot that was wrong within its OWN reconcile commit each time (S22 · live f43bf11
                        vs header e3d183f · the recorded value was the reconcile commit's parent) · root cause =
                        static head/test lines in a tracked file (mathematically un-keepable · Rule 72).
                        RESOLVED STRUCTURALLY T2 S23: the static head-hash + test-count lines are REMOVED from
                        this manifest · the validator now reports live state when none is stored and flags only a
                        FAILING suite or a leftover stale count · flaw #7 can no longer recur by construction.
                        Detector: node scripts/sync-drive-skills.cjs --validate-manifest (ancestry+distance when a
                        hash is present · exit 1 only on real drift).

## ALL DRIVE FILE IDs (folder: 16VcjTyJA95ELauwukSEGXFt3FCgHu1R2)
readme:       1i6U4AU8F9NJLFjiiz23Hepx2WW4q8eNnIHtd1wqde0I
autodrive:    1qlchet5zT4eNJLpQZ8My-nKNArOJ2vAQ9w6tF53c2Nw
omniscan:     1d9x61KGxFRifg-YzjknV85h1DnwBB1pVrZFNfYBkC4c
xray:         10HfvmEYyE9UmfZc6s_0kcg0WiXvFewBVJV5ER9_HBGI
nightsave:    1CHGAxrRVYSHGl9V88QNMgv4l7_co9NLZPVC1jgP_oOE
llmcouncil:   1ZrJhsm5FFQVGZlm5anzgAVZc_zH1cS7S1gCgbwAQxg4
manifest:     1LvIAzmjQgzeagwBJ6DqTeyqadDNmzKz2TDsG7aCMCVE
context:      18lv6K62-oIbCKA4-vQIeCp1vHgIhn2wl3gEXpqwNchM
sessionlog:   1DO9jfa13qnR2qyC_nEbH0yEKZx6F5v2M7X4wh1KIqpU
deepdive:     1fr8pPojdjhA-7CsmGk4SYG9SybT2Gf09z4FEhOmsl50
selfimprove:  1rIX1P_gx35UftbUe5gPqXisVAOxOs4RB56O3S5RU9Pg
t1reviews:    1YUch0UR-YpPNQ48fTxRW7gRJoL9lSzyxZYGVuAaeYdk
t2reviews:    10FkUvJF0Bt0stSmuIMvpdEtiQ4Ccc9x74cskeRzs58c
t3reviews:    11R8fXkcqUitdmvwVEA8sGj2lUDJVjRgKgUcskWAhhw0

## CARD ART (separate folder)
card_art_folder: 1mAMAeriwZSlrTJTFczFX56HCasvUQfyo
cards_in_drive:  20/56 (card1-card20 · all verified 2026-06-28)
cards_in_game:   run: node scripts/sync-drive-skills.cjs --list-card-art
local_path:      ~/NeoTopia/public/art/cards/card_NN.png (zero-padded, underscore)
copy_cmd:        for n in {1..20}; do cp ~/Downloads/card${n}.png ~/NeoTopia/public/art/cards/card_$(printf '%02d' $n).png 2>/dev/null; done

## SERVICE ACCOUNT
Email: neotopia-claude-code@neotopia-drive.iam.gserviceaccount.com
Key: .claude/service-account-key.json (gitignored · never commit)
Sync: node scripts/sync-drive-skills.cjs --all
Terminal reviews: node scripts/sync-drive-skills.cjs --log-terminal-review T[N] ...

## PRODUCTION STATE (T2 S23 · 2026-06-30 · DURABLE FACTS ONLY · live head/tests via --validate-manifest · Rule 71/72)
# Live head + test state: run `node scripts/sync-drive-skills.cjs --validate-manifest`. Do NOT trust any
# written value here for those two facts · this section stores NO head hash or test count by design (Rule 72).
Branch: main · Vercel: neotopia.vercel.app · Build: clean (last verified S23)
Rules: see CLAUDE.md (72 official as of T2 S23 · 70+71+72)
Board biomes: SHIPPED 5c30980 · Sacred City indigo · Living Earth green · Free Energy amber
Flow soft-lock: FIXED d7365bd · Cluster scoring: LIVE 2348daa+442b694
Global Index: 3 rows (2 bot S20 · 1 prod bot S21)
Card art: 20/56 in Drive · 20/20 copied to game (03292b6 · cards 01-20 in game)
Draw RPC migration 011: DEPLOYED + VERIFIED (S22 · supabase 20260630104754 · pgproc=1 ·
  authenticated-only · search_path="") · WIRED T3 S22 · useDrawCard hook (79bb9a9 · 7 vitest green) ·
  was blocked 4 sessions · hook is the RPC primitive · GameRoom integration (src/pages · T1) still pending
Board biomes: shipped · Biome data owned by T2 terrainBiomes.js

## RULES 70 + 71 + 72 (now OFFICIAL in CLAUDE.md)
Rule 70 (T1): A forge can report a feature as missing when it exists but is too subtle
  to perceive · verify rendered output, not just code presence. Enhance in own lane
  rather than rebuild or cross into owner's data file.
Rule 71 (T3): A self-improving system that syncs files but never refreshes the facts
  inside them faithfully mirrors rot. Boot premise-checks must validate live head and test
  count from live source (git rev-parse, vitest) not from a skill file at moment of use.
Rule 72 (T3 S22 · official T2 S23): A freshness/drift gate cannot compare a committed
  artifact to its own live identity by equality · its recorded head is at best its commit's
  parent. Gate on ancestry + bounded distance, never equality. Running a verifier once proves
  it executes, not that its verdict is sound (3 real flaws hid behind one passing run).
  (T2 S23: the cleanest fix is to STOP storing the moving fact · this manifest now does · flaw #7 closed.)

## S21 SUMMARY
T1: Board biomes shipped (5c30980) · 255/300 · Rule 70 discovered
T2: MANIFEST reconciled to truth (64264f8) · prod Flow E2E confirmed 3 rows · 220/300
T3: Live Flow E2E passed · flaw #7 logged · draw RPC re-confirmed blocked · 235/300
