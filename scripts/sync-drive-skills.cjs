#!/usr/bin/env node
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const KEY_FILE = path.join(__dirname, '../.claude/service-account-key.json');
const SKILLS_DIR = path.join(__dirname, '../.claude/skills/library');

const FILE_IDS = {
  readme:       '1i6U4AU8F9NJLFjiiz23Hepx2WW4q8eNnIHtd1wqde0I',
  autodrive:    '1qlchet5zT4eNJLpQZ8My-nKNArOJ2vAQ9w6tF53c2Nw',
  omniscan:     '1d9x61KGxFRifg-YzjknV85h1DnwBB1pVrZFNfYBkC4c',
  xray:         '10HfvmEYyE9UmfZc6s_0kcg0WiXvFewBVJV5ER9_HBGI',
  nightsave:    '1CHGAxrRVYSHGl9V88QNMgv4l7_co9NLZPVC1jgP_oOE',
  llmcouncil:   '1ZrJhsm5FFQVGZlm5anzgAVZc_zH1cS7S1gCgbwAQxg4',
  manifest:     '1LvIAzmjQgzeagwBJ6DqTeyqadDNmzKz2TDsG7aCMCVE',
  context:      '18lv6K62-oIbCKA4-vQIeCp1vHgIhn2wl3gEXpqwNchM',
  sessionlog:   '1DO9jfa13qnR2qyC_nEbH0yEKZx6F5v2M7X4wh1KIqpU',
  deepdive:     '1fr8pPojdjhA-7CsmGk4SYG9SybT2Gf09z4FEhOmsl50',
  selfimprove:  '1rIX1P_gx35UftbUe5gPqXisVAOxOs4RB56O3S5RU9Pg',
};

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
  const bodyContent = doc.data.body.content;
  const endIndex = (bodyContent[bodyContent.length - 1]?.endIndex || 2) - 1;
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

async function main() {
  if (!fs.existsSync(KEY_FILE)) { console.error('❌ Key file missing'); process.exit(1); }
  const [,,cmd,arg,arg2,arg3] = process.argv;
  if (cmd === '--test') await testConnection();
  else if (cmd === '--all') await syncAllSkills();
  else if (cmd === '--skill' && arg) {
    const key = arg.toLowerCase().replace(/_/g,'');
    const fileId = FILE_IDS[key];
    if (!fileId) { console.error(`Unknown: ${arg}\nAvailable: ${Object.keys(FILE_IDS).join(', ')}`); process.exit(1); }
    const f = path.join(SKILLS_DIR, `${arg.toUpperCase()}_SKILL.md`);
    if (!fs.existsSync(f)) { console.error(`Not found: ${f}`); process.exit(1); }
    await writeDocContent(fileId, fs.readFileSync(f,'utf8'), arg);
  } else if (cmd === '--log-flaw') {
    await logFlaw(arg || 'GENERAL', arg2 || 'unspecified', arg3 || '500');
  } else if (cmd === '--log-session') {
    await logSession(arg || 'SESSION', arg2 || 'unspecified', arg3 || '0/300');
  } else {
    console.log('NeoTopia Drive Sync · 11 files · Service Account Auth · Never expires');
    console.log('Commands: --test · --all · --skill <name> · --log-flaw <cat> <flaw> <score> · --log-session <name> <shipped> <score>');
    console.log('Files:', Object.keys(FILE_IDS).join(', '));
  }
}
main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
