#!/usr/bin/env node
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const KEY_FILE = path.join(__dirname, '../.claude/service-account-key.json');
const SKILLS_DIR = path.join(__dirname, '../.claude/skills/library');

const FILE_IDS = {
  readme:        '1i6U4AU8F9NJLFjiiz23Hepx2WW4q8eNnIHtd1wqde0I',
  autodrive:     '1qlchet5zT4eNJLpQZ8My-nKNArOJ2vAQ9w6tF53c2Nw',
  omniscan:      '1d9x61KGxFRifg-YzjknV85h1DnwBB1pVrZFNfYBkC4c',
  xray:          '10HfvmEYyE9UmfZc6s_0kcg0WiXvFewBVJV5ER9_HBGI',
  nightsave:     '1CHGAxrRVYSHGl9V88QNMgv4l7_co9NLZPVC1jgP_oOE',
  llmcouncil:    '1ZrJhsm5FFQVGZlm5anzgAVZc_zH1cS7S1gCgbwAQxg4',
  manifest:      '1LvIAzmjQgzeagwBJ6DqTeyqadDNmzKz2TDsG7aCMCVE',
  context:       '18lv6K62-oIbCKA4-vQIeCp1vHgIhn2wl3gEXpqwNchM',
  sessionlog:    '1DO9jfa13qnR2qyC_nEbH0yEKZx6F5v2M7X4wh1KIqpU',
  deepdive:      '1fr8pPojdjhA-7CsmGk4SYG9SybT2Gf09z4FEhOmsl50',
  selfimprove:   '1rIX1P_gx35UftbUe5gPqXisVAOxOs4RB56O3S5RU9Pg',
  t1reviews:     '1YUch0UR-YpPNQ48fTxRW7gRJoL9lSzyxZYGVuAaeYdk',
  t2reviews:     '10FkUvJF0Bt0stSmuIMvpdEtiQ4Ccc9x74cskeRzs58c',
  t3reviews:     '11R8fXkcqUitdmvwVEA8sGj2lUDJVjRgKgUcskWAhhw0',
  platobooks: '1Qb8VkBdRprU2loJdu4oA9dI2ZmxHxT-AHMJ5dCgU9sQ',
};

const CARD_ART_FOLDER = '1mAMAeriwZSlrTJTFczFX56HCasvUQfyo';
// (the skills Drive folder ID is documented in CLAUDE.md + MANIFEST · the sync writes to the per-file
//  FILE_IDS doc IDs above, never to the folder itself, so a SKILLS_FOLDER constant here was dead · removed
//  T2 S24. listCardArt is the only folder-scoped op and it uses CARD_ART_FOLDER.)

async function getClients() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive'],
  });
  const client = await auth.getClient();
  return { docs: google.docs({ version: 'v1', auth: client }), drive: google.drive({ version: 'v3', auth: client }) };
}

async function testConnection() {
  const { drive } = await getClients();
  const res = await drive.files.get({ fileId: FILE_IDS.manifest, fields: 'name,modifiedTime' });
  console.log(`✅ Connected · "${res.data.name}" · ${res.data.modifiedTime}`);
  console.log(`🏛️  ${Object.keys(FILE_IDS).length} files mapped · Drive sync operational`);
}

async function writeDocContent(docId, content, label) {
  const { docs } = await getClients();
  const doc = await docs.documents.get({ documentId: docId });
  const endIndex = (doc.data.body.content[doc.data.body.content.length - 1]?.endIndex || 2) - 1;
  const requests = [];
  if (endIndex > 1) requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex } } });
  requests.push({ insertText: { location: { index: 1 }, text: content } });
  await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests } });
  console.log(`  ✅ ${label}`);
}

async function appendToDoc(docId, content) {
  const { docs } = await getClients();
  const doc = await docs.documents.get({ documentId: docId });
  const endIndex = (doc.data.body.content[doc.data.body.content.length - 1]?.endIndex || 2) - 1;
  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests: [{ insertText: { location: { index: endIndex }, text: '\n' + content } }] },
  });
}

async function syncAllSkills() {
  const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));
  console.log(`Syncing ${files.length} skill files to Drive...`);
  let synced = 0; let skipped = 0;
  for (const file of files) {
    const key = file.toLowerCase().replace('_skill.md','').replace('.md','').replace(/_/g,'');
    const fileId = FILE_IDS[key];
    if (!fileId) { console.log(`  ⚠️  No Drive ID: ${file}`); skipped++; continue; }
    await writeDocContent(fileId, fs.readFileSync(path.join(SKILLS_DIR, file), 'utf8'), file);
    synced++;
  }
  console.log(`\n🏛️  Done · ${synced} synced · ${skipped} skipped`);
}

async function logFlaw(category, flaw, score) {
  const ts = new Date().toISOString();
  const entry = `\n────────────────────────────────────────────────────────────\n[${ts}] ${category} · SCORE: ${score}/1000\nFLAW: ${flaw}\nFIX: [add fix description]\nRULE BORN: [add rule]\n────────────────────────────────────────────────────────────`;
  await appendToDoc(FILE_IDS.selfimprove, entry);
  console.log(`  ✅ Flaw logged to CLAUDE_SELF_IMPROVE`);
}

async function logSession(session, shipped, score) {
  const ts = new Date().toISOString();
  const entry = `\n────────────────────────────────────────────────────────────\n[${ts}] ${session}\nShipped: ${shipped}\nScore: ${score}\n────────────────────────────────────────────────────────────`;
  await appendToDoc(FILE_IDS.sessionlog, entry);
  console.log(`  ✅ Session logged to SESSION_LOG`);
}

async function logTerminalReview(terminal, session, forge, tasks, codeQ, ruleQ, laneQ, outQ, effQ, gitQ, bruteCritique, pathTo1000) {
  const fileId = FILE_IDS[`${terminal.toLowerCase()}reviews`];
  if (!fileId) { console.error(`Unknown terminal: ${terminal}`); process.exit(1); }
  const total = [tasks, codeQ, ruleQ, laneQ, outQ, effQ, gitQ].map(Number).reduce((a, b) => a + b, 0);
  const ts = new Date().toISOString();
  const entry = `\n════════════════════════════════════════════════════════════\n${terminal.toUpperCase()} · ${session} · [${ts}]\n════════════════════════════════════════════════════════════\nForge rating: ${forge}/200\n\nTask Completion:    ${tasks}/150\nCode Quality:       ${codeQ}/150\nRule Compliance:    ${ruleQ}/150\nLane Discipline:    ${laneQ}/100\nOutput Quality:     ${outQ}/100\nSession Efficiency: ${effQ}/100\nDrive/Git Hygiene:  ${gitQ}/100\n────────────────────────────────────────────────────────────\nTOTAL: ${total}/950\n\nBRUTAL HONEST CRITIQUE:\n${bruteCritique}\n\nPATH TO 1000:\n${pathTo1000}\n════════════════════════════════════════════════════════════`;
  await appendToDoc(fileId, entry);
  console.log(`  ✅ ${terminal.toUpperCase()} review logged (${total}/950)`);
}

async function listCardArt() {
  const { drive } = await getClients();
  const res = await drive.files.list({
    q: `'${CARD_ART_FOLDER}' in parents and mimeType contains 'image/'`,
    fields: 'files(id,name,size)', orderBy: 'name', pageSize: 60,
  });
  const files = res.data.files;
  console.log(`Card Art: ${files.length}/56 images in Drive`);
  files.forEach(f => console.log(`  ${f.name} (${(parseInt(f.size||0)/1024/1024).toFixed(1)}MB)`));
  return files;
}

// ── --validate-manifest (T3 S22 · hardened after adversarial review) ──────────────────────────────
// Born from SELFIMPROVE flaw #7 + Rule 71: "Sync ≠ current." The manifest is SYNCED to Drive every
// NIGHTSAVE, but the FACTS inside it (HEAD hash · test count) are write-time snapshots that rot the
// moment a commit lands or a test is added. This command makes the rot machine-detectable and exits 1
// on real drift so it gates pre-NIGHTSAVE / CI. It NEVER edits the manifest (detector, not fixer).
//
// THREE THINGS THE NAIVE FIRST VERSION GOT WRONG (each caught by adversarial review · all fixed here):
//  1. HEAD can NEVER exactly-equal the live committed HEAD: a tracked file cannot contain the short hash
//     of the very commit that includes it (the manifest's HEAD is at best its own commit's PARENT). So
//     `manHead === liveHead` is structurally unsatisfiable in any committed checkout → a permanent red
//     light. A snapshot is SUPPOSED to lag · so instead validate that manHead is a real ANCESTOR of live
//     HEAD (names a commit actually on this history, not a garbage/forked hash) and report HOW FAR behind.
//     Hard-fail only when manHead is NOT an ancestor, or is more than MAX_HEAD_DRIFT commits behind.
//  2. The manifest declares HEAD/Tests TWICE (header line + PRODUCTION STATE block). A non-global match
//     read only the FIRST, so a PARTIAL reconcile (update one, forget the other) passed as MATCH. Now we
//     collect ALL declarations and require internal agreement before comparing to live.
//  3. On a vitest FAILURE the count regex was unanchored and captured the "Test Files N passed" line
//     instead of "Tests N passed". Both passed/failed parses are now anchored to the Tests summary line.
// (Rule 67: gate what's true WHERE the gate runs · the HEAD/tests checked are this checkout's live truth.)
const MAX_HEAD_DRIFT = 20; // the manifest is reconciled every NIGHTSAVE; even a busy multi-terminal session
                           // rarely pushes >20 commits between reconciles, so beyond that the manifest spans
                           // multiple UNreconciled sessions = genuinely stale. Tune freely · HEAD gate only.
async function validateManifest() {
  const { execSync } = require('child_process');
  const repoRoot = path.join(__dirname, '..');
  const git = (cmd) => execSync(cmd, { cwd: repoRoot, encoding: 'utf8' }).trim();
  const manifestPath = path.join(SKILLS_DIR, 'MANIFEST_SKILL.md');
  if (!fs.existsSync(manifestPath)) { console.error(`❌ MANIFEST not found: ${manifestPath}`); process.exit(1); }
  const manifest = fs.readFileSync(manifestPath, 'utf8');

  // ── Live truth ──────────────────────────────────────────────────────────────────────────────
  let liveHead = null;
  try { liveHead = git('git rev-parse --short HEAD'); }
  catch (e) { console.error(`❌ git rev-parse failed: ${e.message}`); process.exit(1); }

  console.log('🔍 MANIFEST VALIDATION · running vitest (live test count) ...');
  let liveTests = null, liveFailed = 0;
  // Anchor to the "Tests" summary line · vitest prints "Test Files N passed" FIRST, so an unanchored
  // /(\d+)\s+passed/ captures the FILE count, not the test count (finding #3).
  const parseTests = (out) => {
    const pm = out.match(/Tests\s+.*?(\d+)\s+passed/s); if (pm) liveTests = parseInt(pm[1], 10);
    const fm = out.match(/Tests\s+.*?(\d+)\s+failed/s); if (fm) liveFailed = parseInt(fm[1], 10);
  };
  try {
    parseTests(execSync('npx vitest run', { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 }));
  } catch (e) {
    parseTests((e.stdout || '') + (e.stderr || '')); // non-zero exit on failure · still parse (a failing suite is drift)
  }

  // ── Manifest claims · collect ALL declarations, require internal agreement (finding #2 · partial reconcile) ──
  const uniq = (arr) => [...new Set(arr)];
  const headDecls = uniq([...manifest.matchAll(/HEAD:\s*([0-9a-f]{7,40})/gi)].map(m => m[1].toLowerCase()));
  const testDecls = uniq([...manifest.matchAll(/Tests:\s*(\d+)/gi)].map(m => parseInt(m[1], 10)));
  const headConsistent  = headDecls.length === 1;
  const testsConsistent = testDecls.length === 1;
  const manHead  = headDecls.length ? headDecls.join(' / ') : '(none)';
  const manTests = testDecls.length ? testDecls.join(' / ') : '(none)';

  // ── HEAD: ancestry + distance, NOT equality (finding #1) ──────────────────────────────────────
  // manHead is regex-constrained to hex [0-9a-f]{7,40}, so interpolating it into the git command below
  // has zero shell-injection surface (it cannot contain a metacharacter).
  let headOk = false, headDetail = '';
  if (headDecls.length === 0) {
    // DESIRED END STATE (Rule 72 · T2 S23): the manifest stores NO static head hash. A tracked file can
    // never contain the short hash of its own commit, so any stored value is born stale (it reconciled to
    // a value already wrong the instant it was committed · S21 64264f8, S22 f43bf11). Absence is correct;
    // there is nothing to rot. This command is now the LIVE-state reporter · print live head and pass.
    headOk = true;
    headDetail = `no stored head claim (Rule 72 · nothing to rot) · live ${liveHead}`;
  } else if (!headConsistent) {
    headDetail = `manifest disagrees with itself: ${manHead}`;
  } else {
    const h = headDecls[0];
    let isAncestor = false;
    try { execSync(`git merge-base --is-ancestor ${h} HEAD`, { cwd: repoRoot, stdio: 'ignore' }); isAncestor = true; }
    catch { isAncestor = false; } // non-zero exit = not an ancestor (or unknown object)
    if (!isAncestor) {
      headDetail = `${h} is NOT an ancestor of live HEAD ${liveHead} (off-branch / unknown / garbage hash)`;
    } else {
      let distance = null;
      try { distance = parseInt(git(`git rev-list --count ${h}..HEAD`), 10); } catch { distance = null; }
      if (distance === 0) { headOk = true; headDetail = 'exactly current'; }
      else if (distance != null && distance <= MAX_HEAD_DRIFT) { headOk = true; headDetail = `${distance} commit(s) behind (≤ ${MAX_HEAD_DRIFT} · fresh)`; }
      else { headDetail = `${distance} commit(s) behind (> ${MAX_HEAD_DRIFT} · STALE · reconcile)`; }
    }
  }

  // ── Tests: zero failures ALWAYS required · a stored count (if any) must also match (Rule 72 · T2 S23) ──
  // With no stored count (the desired end state) the only drift signal is a FAILING suite · a count rots
  // the moment a test is added, so we no longer demand one. When a count IS still stored, keep the exact-
  // match gate (finding #3 makes liveTests trustworthy) so a stale leftover count is still caught.
  const testsOk = testDecls.length === 0
    ? (liveTests != null && liveFailed === 0)
    : (testsConsistent && liveTests != null && testDecls[0] === liveTests && liveFailed === 0);
  const mark = (ok) => ok ? '✅ MATCH' : '❌ DRIFT';

  console.log('🔍 MANIFEST VALIDATION');
  console.log(`  HEAD   · live ${liveHead} · manifest ${manHead} · ${mark(headOk)} · ${headDetail}`);
  const manTestsLabel = testDecls.length === 0 ? '(none · by design · Rule 72)' : `${manTests}${testsConsistent ? '' : ' (self-inconsistent)'}`;
  console.log(`  Tests  · live ${liveTests == null ? '(unknown · vitest unparsed)' : liveTests}${liveFailed ? ` (${liveFailed} FAILED)` : ''} · manifest ${manTestsLabel} · ${mark(testsOk)}`);
  console.log('────────────────────────────────────────────────────────────');
  if (headOk && testsOk) {
    console.log('✅ MANIFEST CURRENT · head/test state verified against live (no stale snapshot to reconcile).');
    return;
  }
  console.error('❌ DRIFT DETECTED · fix before NIGHTSAVE --all (else you sync rot · Rule 71): if a FAILING suite, make tests green; if a stale leftover head/test line in MANIFEST_SKILL.md, REMOVE it (do NOT re-add a snapshot · Rule 72).');
  process.exit(1);
}

async function main() {
  if (!fs.existsSync(KEY_FILE)) { console.error('❌ Key file missing'); process.exit(1); }
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === '--test') await testConnection();
  else if (cmd === '--all') await syncAllSkills();
  else if (cmd === '--skill' && rest[0]) {
    const key = rest[0].toLowerCase().replace(/_/g,'');
    const fileId = FILE_IDS[key];
    if (!fileId) { console.error(`Unknown: ${rest[0]}\nAvailable: ${Object.keys(FILE_IDS).join(', ')}`); process.exit(1); }
    const f = path.join(SKILLS_DIR, `${rest[0].toUpperCase()}_SKILL.md`);
    if (!fs.existsSync(f)) { console.error(`Not found: ${f}`); process.exit(1); }
    await writeDocContent(fileId, fs.readFileSync(f,'utf8'), rest[0]);
  }
  else if (cmd === '--log-flaw') await logFlaw(rest[0]||'GENERAL', rest[1]||'unspecified', rest[2]||'500');
  else if (cmd === '--log-session') await logSession(rest[0]||'SESSION', rest[1]||'unspecified', rest[2]||'0');
  else if (cmd === '--log-terminal-review') await logTerminalReview(...rest);
  else if (cmd === '--list-card-art') await listCardArt();
  else if (cmd === '--validate-manifest') await validateManifest();
  else {
    console.log('NeoTopia Drive Sync · 15 files · Service Account · Never expires');
    console.log('--test · --all · --skill <name> · --log-flaw · --log-session · --log-terminal-review · --list-card-art · --validate-manifest');
    console.log('Files:', Object.keys(FILE_IDS).join(', '));
  }
}
main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
