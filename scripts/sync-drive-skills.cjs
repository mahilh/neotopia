#!/usr/bin/env node
/**
 * NeoTopia Drive Skills Sync · Service Account · Never expires · Fully automated
 * Usage:
 *   node scripts/sync-drive-skills.cjs --test
 *   node scripts/sync-drive-skills.cjs --all
 *   node scripts/sync-drive-skills.cjs --skill xray
 *   node scripts/sync-drive-skills.cjs --read manifest
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const KEY_FILE = path.join(__dirname, '../.claude/service-account-key.json');
const SKILLS_DIR = path.join(__dirname, '../.claude/skills/library');

const FILE_IDS = {
  readme:      '1i6U4AU8F9NJLFjiiz23Hepx2WW4q8eNnIHtd1wqde0I',
  autodrive:   '1qlchet5zT4eNJLpQZ8My-nKNArOJ2vAQ9w6tF53c2Nw',
  omniscan:    '1d9x61KGxFRifg-YzjknV85h1DnwBB1pVrZFNfYBkC4c',
  xray:        '10HfvmEYyE9UmfZc6s_0kcg0WiXvFewBVJV5ER9_HBGI',
  nightsave:   '1CHGAxrRVYSHGl9V88QNMgv4l7_co9NLZPVC1jgP_oOE',
  llmcouncil:  '1ZrJhsm5FFQVGZlm5anzgAVZc_zH1cS7S1gCgbwAQxg4',
  manifest:    '1LvIAzmjQgzeagwBJ6DqTeyqadDNmzKz2TDsG7aCMCVE',
  context:     '18lv6K62-oIbCKA4-vQIeCp1vHgIhn2wl3gEXpqwNchM',
  sessionlog:  '1DO9jfa13qnR2qyC_nEbH0yEKZx6F5v2M7X4wh1KIqpU',
};

async function getClients() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive',
    ],
  });
  const client = await auth.getClient();
  return {
    docs: google.docs({ version: 'v1', auth: client }),
    drive: google.drive({ version: 'v3', auth: client }),
  };
}

async function testConnection() {
  console.log('Testing service account connection...');
  try {
    const { drive } = await getClients();
    const res = await drive.files.get({
      fileId: FILE_IDS.manifest,
      fields: 'name,modifiedTime',
    });
    console.log(`✅ Connected`);
    console.log(`   File: "${res.data.name}"`);
    console.log(`   Modified: ${res.data.modifiedTime}`);
    console.log('🏛️  NeoTopia Drive sync is fully operational');
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    if (err.message.includes('not been shared') || err.message.includes('notFound')) {
      console.log('\nFix: share each Drive doc with:');
      console.log('  neotopia-claude-code@neotopia-drive.iam.gserviceaccount.com');
      console.log('  Role: Editor');
    }
    if (err.message.includes('disabled')) {
      console.log('\nFix: enable Google Docs API at console.cloud.google.com');
    }
    process.exit(1);
  }
}

async function readDocContent(docId) {
  const { docs } = await getClients();
  const doc = await docs.documents.get({ documentId: docId });
  return doc.data.body.content
    .map(el => el.paragraph?.elements?.map(e => e.textRun?.content || '').join('') || '')
    .join('');
}

async function writeDocContent(docId, content, label) {
  const { docs } = await getClients();
  const doc = await docs.documents.get({ documentId: docId });
  const bodyContent = doc.data.body.content;
  const lastEl = bodyContent[bodyContent.length - 1];
  const endIndex = (lastEl?.endIndex || 2) - 1;

  const requests = [];
  if (endIndex > 1) {
    requests.push({
      deleteContentRange: { range: { startIndex: 1, endIndex } },
    });
  }
  requests.push({
    insertText: { location: { index: 1 }, text: content },
  });

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests },
  });
  console.log(`  ✅ ${label || docId.slice(0, 24)}...`);
}

async function syncAllSkills() {
  if (!fs.existsSync(SKILLS_DIR)) {
    console.log('No skills/library directory. Creating...');
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
    console.log('Add .md files to .claude/skills/library/ then run --all again.');
    return;
  }

  const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));
  if (files.length === 0) {
    console.log('No .md skill files found in .claude/skills/library/');
    return;
  }

  console.log(`Syncing ${files.length} skill files to Drive...`);
  let synced = 0;
  let skipped = 0;

  for (const file of files) {
    const key = file.toLowerCase()
      .replace('_skill.md', '')
      .replace('.md', '')
      .replace(/_/g, '');
    const fileId = FILE_IDS[key];

    if (!fileId) {
      console.log(`  ⚠️  No Drive ID mapped for: ${file} (add to FILE_IDS if needed)`);
      skipped++;
      continue;
    }

    const content = fs.readFileSync(path.join(SKILLS_DIR, file), 'utf8');
    await writeDocContent(fileId, content, file);
    synced++;
  }

  console.log(`\n🏛️  Done · ${synced} synced · ${skipped} skipped`);
  console.log('All NeoTopia skill files are now live in Google Drive.');
}

async function main() {
  if (!fs.existsSync(KEY_FILE)) {
    console.error(`❌ Key file not found at: ${KEY_FILE}`);
    console.log('Run: cp ~/Downloads/neotopia-drive-*.json .claude/service-account-key.json');
    process.exit(1);
  }

  const [, , cmd, arg] = process.argv;

  if (cmd === '--test') {
    await testConnection();
  } else if (cmd === '--all') {
    await syncAllSkills();
  } else if (cmd === '--skill' && arg) {
    const key = arg.toLowerCase().replace(/_/g, '');
    const fileId = FILE_IDS[key];
    if (!fileId) {
      console.error(`Unknown skill: "${arg}"`);
      console.log('Available keys:', Object.keys(FILE_IDS).join(', '));
      process.exit(1);
    }
    const skillFile = path.join(SKILLS_DIR, `${arg.toUpperCase()}_SKILL.md`);
    if (!fs.existsSync(skillFile)) {
      console.error(`Skill file not found: ${skillFile}`);
      process.exit(1);
    }
    const content = fs.readFileSync(skillFile, 'utf8');
    await writeDocContent(fileId, content, arg);
    console.log('Done.');
  } else if (cmd === '--read' && arg) {
    const key = arg.toLowerCase().replace(/_/g, '');
    const fileId = FILE_IDS[key];
    if (!fileId) {
      console.error(`Unknown skill: "${arg}"`);
      process.exit(1);
    }
    const content = await readDocContent(fileId);
    console.log(content);
  } else {
    console.log('NeoTopia Drive Sync · Service Account Auth · Never expires\n');
    console.log('Commands:');
    console.log('  --test              verify connection to Drive');
    console.log('  --all               sync all skill files to Drive');
    console.log('  --skill <name>      sync one skill (e.g. --skill xray)');
    console.log('  --read <name>       read one skill from Drive');
    console.log('\nAvailable skills:', Object.keys(FILE_IDS).join(', '));
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
