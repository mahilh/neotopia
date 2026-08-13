// NeoTopia · which dev server a Playwright run is allowed to talk to (T3 S63).
//
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE DEFECT THIS EXISTS FOR, MEASURED RATHER THAN IMAGINED
//
// This project has two standing disciplines, both mature, both correct alone:
//
//     Rule 82         isolate in a detached worktree before believing any live failure
//     playwright.config.js   webServer.reuseExistingServer: !CI  (so a dev server you already have is reused)
//
// Compose them and a worktree run drives THE MAIN CLONE'S APP. Both worktree and main tree ask for
// http://localhost:5173; if anything is already listening there · another lane's `npm run dev`, your own
// from an hour ago · Playwright reuses it and never starts the worktree's. The spec files come from the
// worktree (testDir is relative to the config) and the APPLICATION comes from somewhere else entirely.
//
// MEASURED, S63, and it is what forced this file. Two mutations of src/pages/GameRoom.jsx inside a
// worktree · delete the region button's label, and rename its testid · both came back GREEN, together
// with an unmutated baseline, three runs indistinguishable to the character:
//
//     BASELINE   keyboard audit 6 passed   endgame diagnostic 2 passed
//     R1 label   keyboard audit 6 passed   endgame diagnostic 2 passed
//     R2 testid  keyboard audit 6 passed   endgame diagnostic 2 passed
//
// A dev server (pid 86969) was listening on 5173 from the main clone. Nothing I edited was ever loaded by
// a browser. I was one sentence from recording "both assertions are toothless" · which is a false claim
// about my own guard, produced by an environment condition with no symptom.
//
// ⚠ THE FAILURE MODE IS ALWAYS GREEN, WHICH IS WHY IT IS WORTH A FILE. A mutation that reaches the browser
// reds. A mutation that never arrives passes. So this composition can only ever tell you that your guard
// has no teeth, and that is exactly the conclusion a careful person writes down and acts on. Same shape as
// Rule 131 (two disciplines, each right, colliding in a component neither owns) and Rule 130 (the output
// could have been produced two ways, and the run cannot say which).
//
// THE FIX IS NOT PROSE. "Remember to use a different port in a worktree" is a manual step at a decision
// point, which is the thing that will not happen (Rule 131c). git already knows the answer: a LINKED
// worktree's --git-dir and --git-common-dir differ, and in the main clone they are the same. One lookup,
// no discipline required, and it cannot be forgotten.
//
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE COUNTERWEIGHT, WRITTEN FIRST (preamble §2)
//
// The tempting fix buys the worktree case by changing what CI does, which trades a silent local hazard for
// a loud broken gate for everybody (T2's Rule 131 counterweight, and it applies unchanged here). So the
// binding requirement is the CASE THAT MUST NOT MOVE: in the main clone, and in CI, this must resolve to
// EXACTLY http://localhost:5173 with exactly the reuse policy the config had before this file existed.
// devServerTarget.test.js asserts that first, before it asserts anything about worktrees.

export const DEFAULT_PORT = 5173

// Deterministic, stable, and confined to the IANA dynamic range: the same worktree gets the same port every
// run, so a server left over from your previous run IS yours and reusing it is correct. Two worktrees
// collide only if their paths hash equal, which costs a port conflict Vite reports loudly · not a silent
// wrong-tree run, which is the whole point.
const WORKTREE_PORT_SPAN = 300

function hashPath(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return Math.abs(h)
}

const strip = (p) => String(p ?? '').replace(/\/+$/, '')

/**
 * Decide the origin a Playwright run may use, from facts the caller reads rather than from where it thinks
 * it is. Pure · no git, no filesystem, no process · so both branches are testable without a worktree.
 *
 * @param {object}  o
 * @param {string}  o.gitDir           `git rev-parse --git-dir`         (absolute)
 * @param {string}  o.gitCommonDir     `git rev-parse --git-common-dir`  (absolute)
 * @param {string}  o.cwd              the checkout the run was launched from
 * @param {boolean} o.isCI
 * @param {boolean} [o.hasEnvFile]     a .env.local exists in THIS checkout (what Vite will load)
 * @param {boolean} [o.mainHasEnvFile] a .env.local exists in the main clone
 * @returns {{ port:number, origin:string, reuse:boolean, linkedWorktree:boolean, why:string,
 *            envWarning: string|null }}
 */
export function resolveDevServer({ gitDir, gitCommonDir, cwd, isCI, hasEnvFile, mainHasEnvFile }) {
  // In the main clone both resolve to the same directory. In a LINKED worktree --git-dir is
  // <common>/worktrees/<name> and --git-common-dir is <common>. Absence of either (a tarball, a
  // non-git checkout) is treated as the main clone · the case that must not move.
  const linkedWorktree = Boolean(gitDir) && Boolean(gitCommonDir) && strip(gitDir) !== strip(gitCommonDir)

  const port = linkedWorktree
    ? DEFAULT_PORT + 1 + (hashPath(strip(cwd)) % WORKTREE_PORT_SPAN)
    : DEFAULT_PORT

  // ── THE SECOND DEFECT, WHICH THE PORT FIX EXPOSED RATHER THAN CAUSED (T3 S63) ──────────────────────
  // scripts/with-project-env.cjs finds the main clone's .env.local (T2's Rule 131 fix) and uses it to
  // STRIP shadowing shell variables. It never INJECTS: one `delete env[name]` and no assignment. So the
  // values still have to reach Vite by Vite's own route, which is an env file in VITE'S ROOT · and a
  // linked worktree has none, because .env.local is gitignored. Measured: `npm run dev` in a worktree
  // serves an app that throws at module load, `src/lib/supabase.js:11`, before any spec runs.
  //     with-project-env.cjs   one `delete env[name]`, zero assignments into env
  //     vite.config.js         no envDir
  //     vite CLI               has no --envDir (CACError: Unknown option `--envDir`) · tested, not assumed
  // A WORKTREE `npm run dev` HAS THEREFORE NEVER WORKED, and nobody could see it: reuseExistingServer
  // handed every worktree run the main clone's already-credentialed server, so the broken one was never
  // started. Two defects, and the healthy-looking one was compensating for the other.
  // The structural fix is not in this lane (with-project-env should inject what it has already parsed,
  // or vite.config.js should set envDir to the common dir). Until then a worktree run FAILS LOUDLY, and
  // this warning is why it fails with its own name on it rather than as `practice-badge not found` after
  // a 20s timeout · a diagnosis that reads as a product defect is the thing this project keeps paying for.
  const envWarning = linkedWorktree && hasEnvFile === false && mainHasEnvFile === true
    ? 'no .env.local in this worktree · Vite loads env files from its OWN root, and with-project-env only ' +
      'STRIPS shadowing variables, it does not inject. The dev server will boot and the app will throw at ' +
      'src/lib/supabase.js on load. Cheapest unblock for right now: `cp <main-clone>/.env.local .` here. ' +
      'The fix belongs in with-project-env (inject what it parsed) or vite.config.js (envDir).'
    : null

  return {
    port,
    origin: `http://localhost:${port}`,
    envWarning,
    // UNCHANGED IN BOTH BRANCHES. The port is the whole fix; touching the reuse policy would change what
    // CI does, and a worktree on its own port has nothing to wrongly reuse anyway. Reuse stays ON locally
    // so a server left running from YOUR worktree is picked up · it serves the same tree, so that is right.
    reuse: !isCI,
    linkedWorktree,
    why: linkedWorktree
      ? `linked worktree at ${strip(cwd)} · its own port, so it cannot silently drive the main clone's app`
      : 'main clone · the default port and the pre-S63 behaviour, byte for byte',
  }
}
