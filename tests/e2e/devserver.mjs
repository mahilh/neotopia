#!/usr/bin/env node
// NeoTopia · dev-server ownership · start/stop only what is YOURS (T3 S32).
//
// THE INCIDENT THIS EXISTS FOR
//   In S31 I ran `pkill -f vite` to clean up a stray dev server I had started on the wrong port. That
//   pattern matches EVERY vite process on the machine, and this repo is worked by three terminals at
//   once, so it also killed a dev server another lane was using. The command was not wrong about what
//   I wanted · it was wrong about what it could see. A pattern match over process names has no concept
//   of ownership, and in a shared working tree ownership is the only thing that matters.
//
// THE HONEST FIRST ANSWER, before any of the code below
//   Do not start one. playwright.config.js sets reuseExistingServer: !CI, so Playwright starts a dev
//   server when there is none and reuses yours when there is. The S31 mistake began one step earlier
//   than the pkill: there was no reason to launch a server by hand at all. This tool exists for the
//   case that remains · holding one server up across many separate playwright invocations, which is
//   genuinely faster · and its job is to make that case safe rather than to encourage it.
//
// THE RULE
//   `stop` kills only a process THIS TOOL started, verified twice: the recorded pid must still be
//   alive, and it must still be the process listening on the recorded port. Anything else and it
//   refuses out loud. A tool that cannot tell whose server it is should decline, not guess.
//
// Ownership is recorded in the OS temp dir keyed by repo path, so nothing lands in the repo and two
// checkouts never share a record. Playwright's testMatch is '**/*.e2e.js', so this .mjs is invisible
// to the runner (same convention as draw-rpc-concurrency.mjs).
//
// Usage:  node tests/e2e/devserver.mjs start | status | stop

import { spawn, execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, unlinkSync, openSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = Number(process.env.NEOTOPIA_DEV_PORT || 5173)
const RECORD = join(tmpdir(), `neotopia-devserver-${createHash('sha1').update(REPO).digest('hex').slice(0, 10)}.json`)
const LOG = join(tmpdir(), `neotopia-devserver-${PORT}.log`)

// Who is listening on the port RIGHT NOW · the ground truth, independent of anything we recorded.
// lsof over a fixed port rather than a name pattern: a port has exactly one listener, a name has many.
// execFileSync with an ARGUMENT ARRAY, not execSync with a template string: the port comes from an
// environment variable, and a shell string would let a malformed value become a command. No shell is
// spawned here, so nothing in the value can be interpreted.
function listenerPid(port) {
  const p = Number(port)
  if (!Number.isInteger(p) || p < 1 || p > 65535) return null
  try {
    const out = execFileSync('lsof', ['-ti', `tcp:${p}`, '-sTCP:LISTEN'], { stdio: ['ignore', 'pipe', 'ignore'] })
    const pids = String(out).trim().split('\n').filter(Boolean).map(Number)
    return pids[0] ?? null
  } catch { return null } // lsof exits non-zero when nothing is listening
}

// The process GROUP a pid belongs to. This is the ownership primitive, and getting it wrong was a real
// bug in the first version of this file: `npm run dev` spawns node which spawns vite, and it is the
// GRANDCHILD that holds the port. Comparing the listener's pid to the pid we recorded therefore never
// matched, and the tool refused to stop its own server every single time · a refusal that looked
// exactly like the safety feature working. Because start() uses detached:true, our child is a group
// LEADER and every descendant inherits its pgid, so "is the listener in my group?" is both the correct
// question and a strictly stronger one than "is the listener my child?".
function pgidOf(pid) {
  if (!Number.isInteger(pid)) return null
  try {
    const out = execFileSync('ps', ['-o', 'pgid=', '-p', String(pid)], { stdio: ['ignore', 'pipe', 'ignore'] })
    const n = Number(String(out).trim())
    return Number.isInteger(n) ? n : null
  } catch { return null }
}
const ownsListener = (rec) => {
  const holder = listenerPid(rec?.port)
  return holder != null && pgidOf(holder) === rec?.pgid ? holder : null
}
const readRecord = () => { try { return JSON.parse(readFileSync(RECORD, 'utf8')) } catch { return null } }
const clearRecord = () => { try { unlinkSync(RECORD) } catch { /* already gone */ } }

async function serving(port) {
  try {
    const res = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch { return false }
}

async function start() {
  if (await serving(PORT)) {
    const pid = listenerPid(PORT)
    const mine = ownsListener(readRecord())
    console.log(`REUSING · something is already serving :${PORT} (pid ${pid ?? '?'})${mine ? ' · started by this tool' : ' · NOT ours, leaving it alone'}`)
    return 0
  }

  // detached:true puts the child in its OWN process group. npm spawns node spawns vite, and killing
  // only the npm pid would orphan the vite that actually holds the port · the group is the unit that
  // has to die, which is the second half of why pkill felt necessary in the first place.
  const fd = openSync(LOG, 'a')
  const child = spawn('npm', ['run', 'dev'], { cwd: REPO, detached: true, stdio: ['ignore', fd, fd] })
  child.unref()

  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (await serving(PORT)) {
      writeFileSync(RECORD, JSON.stringify({
        pid: child.pid, pgid: child.pid, port: PORT, repo: REPO, log: LOG,
      }, null, 2))
      console.log(`STARTED · :${PORT} · pgid ${child.pid} · log ${LOG}`)
      return 0
    }
    await new Promise(r => setTimeout(r, 500))
  }
  console.error(`FAILED · nothing answered :${PORT} within 60s · see ${LOG}`)
  return 1
}

async function status() {
  const up = await serving(PORT)
  const pid = listenerPid(PORT)
  const rec = readRecord()
  console.log(`port     : ${PORT} ${up ? 'SERVING' : 'silent'}`)
  console.log(`listener : ${pid ?? '(none)'} ${pid ? `(pgid ${pgidOf(pid) ?? '?'})` : ''}`)
  console.log(`ours     : ${!rec ? 'no record'
    : ownsListener(rec) ? `yes · process group ${rec.pgid}`
    : `no · we recorded group ${rec.pgid}, but ${pid ?? 'nobody'} holds the port · stale record`}`)
  return 0
}

function stop() {
  const rec = readRecord()
  if (!rec) {
    console.log(`NOTHING TO STOP · this tool has no record of starting a server for ${REPO}.`)
    console.log(`If a server is running, it belongs to another terminal or to Playwright. Leave it.`)
    return 0
  }
  const holder = listenerPid(rec.port)
  if (holder == null) {
    console.log(`ALREADY GONE · nothing is listening on :${rec.port}. Clearing the record only.`)
    clearRecord()
    return 0
  }
  // THE OWNERSHIP TEST. Not "is the listener the pid we spawned" (it never is · npm spawns node spawns
  // vite) but "is the listener inside the process group we created". Anything else is somebody's
  // server and the answer is no.
  if (!ownsListener(rec)) {
    console.error(`REFUSING · :${rec.port} is held by pid ${holder} in group ${pgidOf(holder) ?? '?'}, not our group ${rec.pgid}.`)
    console.error(`That is somebody else's server (or ours died and another process took the port).`)
    console.error(`Killing it is exactly the S31 mistake. Clearing our stale record and stopping nothing.`)
    clearRecord()
    return 1
  }
  // Negative pid = the process GROUP · npm, node and vite together, and nothing outside it.
  try { process.kill(-rec.pgid, 'SIGTERM') } catch { try { process.kill(rec.pid, 'SIGTERM') } catch { /* raced */ } }
  clearRecord()
  console.log(`STOPPED · process group ${rec.pgid} on :${rec.port} · nothing else was touched.`)
  return 0
}

const cmd = process.argv[2] ?? 'status'
const run = cmd === 'start' ? start : cmd === 'stop' ? async () => stop() : cmd === 'status' ? status : null
if (!run) {
  console.error('usage: node tests/e2e/devserver.mjs start|status|stop')
  process.exit(2)
}
process.exit(await run())
