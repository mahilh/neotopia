import { describe, test, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname, resolve, extname } from 'node:path'

// T2 S43 · RULE 97 APPLIED TO MYSELF.
//
// Migration 011 cited "PROVEN EMPIRICALLY T3 S23 · FOR UPDATE serialized: YES" for nineteen sessions
// while the harness it names died ON IMPORT. seedHelpers.js re-exported `from './fixtureNames'` with no
// file extension · fine under Playwright's bundler, fatal under raw node ESM · and the draw harnesses
// are standalone `node` scripts. Nothing could report it: a harness in no workflow cannot report its
// own decay, and a comment citing one cannot either.
//
// I wrote that rule and then shipped a SECOND harness with the identical exposure the same night. This
// is the instrument, and the design constraint is what makes it cheap: these scripts run `main()` at
// module scope, so actually importing one would sign in, hit the network and mutate. So this does not
// import anything. It STATICALLY RESOLVES the import graph, recursively, which is precisely the class
// of breakage that occurred · a specifier that a bundler forgives and node does not.
//
// No network, no sign-in, no assertions about behaviour. Milliseconds. It cannot tell you the harness
// still PROVES what it claims · only that it still LOADS. That is a real limit and it is stated rather
// than papered over: the S23 rot was a load failure, and a load check would have caught it on day one.

const ROOT = process.cwd()
// 'tests' as well as 'tests/e2e' · board-probe.mjs lives one level up, and a gate that silently misses
// a harness is the thing this file exists to prevent. Non-recursive per directory, listed explicitly,
// so adding a harness dir is a deliberate act rather than something a glob decides.
const HARNESS_DIRS = ['tests', 'tests/e2e']
const RESOLVABLE = ['.js', '.mjs', '.cjs', '.json', '.jsx']

function harnesses() {
  const out = []
  for (const d of HARNESS_DIRS) {
    const abs = join(ROOT, d)
    if (!existsSync(abs)) continue
    for (const f of readdirSync(abs)) if (f.endsWith('.mjs')) out.push(join(abs, f))
  }
  return out
}

// Relative specifiers only · bare specifiers are node_modules and resolve by their own rules.
function relativeImports(file) {
  const src = readFileSync(file, 'utf8')
  const specs = []
  const patterns = [
    /\bfrom\s+['"](\.[^'"]+)['"]/g,      // import x from './y'  ·  export { x } from './y'
    /\bimport\s*\(\s*['"](\.[^'"]+)['"]/g, // dynamic import('./y')
    /\brequire\s*\(\s*['"](\.[^'"]+)['"]/g,
  ]
  for (const p of patterns) for (const m of src.matchAll(p)) specs.push(m[1])
  return specs
}

// ESM does not do extension inference. A specifier without one is a load failure under raw node even
// though every bundler in the project resolves it happily · that asymmetry IS the bug.
function resolveSpec(fromFile, spec) {
  const target = resolve(dirname(fromFile), spec)
  if (RESOLVABLE.includes(extname(spec))) {
    return existsSync(target) ? { ok: true, target } : { ok: false, why: 'file does not exist' }
  }
  const wouldWork = RESOLVABLE.map(e => target + e).find(existsSync)
  return { ok: false, why: wouldWork ? `no extension · add '${extname(wouldWork)}'` : 'unresolvable' }
}

function walk(entry, seen = new Set(), broken = []) {
  if (seen.has(entry)) return broken
  seen.add(entry)
  for (const spec of relativeImports(entry)) {
    const r = resolveSpec(entry, spec)
    if (!r.ok) broken.push(`${entry.replace(ROOT + '/', '')} → '${spec}' · ${r.why}`)
    else walk(r.target, seen, broken)
  }
  return broken
}

describe('standalone harness integrity', () => {
  // COUNTERWEIGHT FIRST (Rule 90). Every assertion below is a loop over a discovered list, so the
  // cheapest way to be green forever is to discover nothing · a renamed directory, a changed
  // extension, a bad ROOT. Last session I shipped a counterweight whose mutation passed because the
  // scenario could not arise; this one asserts the inputs exist before anything reads them.
  test('the audit found harnesses and can see through them', () => {
    const hs = harnesses()
    expect(hs.length, 'no .mjs harnesses discovered · every check below is vacuous').toBeGreaterThan(0)
    // and it must actually be parsing imports, not returning [] for everything
    const total = hs.reduce((n, h) => n + relativeImports(h).length, 0)
    expect(total, 'no relative imports parsed · the regexes match nothing and cannot fail').toBeGreaterThan(0)
  })

  test('every standalone harness resolves under raw node ESM · the S23 rot, gated', () => {
    // deduped: several harnesses share seedHelpers, so one bad specifier would otherwise be reported
    // once per entry point and read like several distinct faults.
    const broken = [...new Set(harnesses().flatMap(h => walk(h)))]
    expect(broken, [
      '',
      'These load-fail under `node` even though the bundler resolves them, so the harness dies before',
      'its first assertion · which is how migration 011 cited a proof that could not run for nineteen',
      'sessions. ESM has no extension inference: write the extension.',
      '',
    ].join('\n')).toEqual([])
  })
})
