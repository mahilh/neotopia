// THE FOUNDER'S NAME IS NOT IN THE PRODUCT (T1 S50 · Mahil asked directly).
//
// Four occurrences shipped in the bundle: two paragraphs of prose in THE PURPOSE section, and the
// footer link twice · once as href and once as its own visible text. The prose is rewritten with no
// person in it (the ideas survive: a building meant to be built, a five-stage project this game is
// stage two of) and the link keeps its href while its LABEL becomes "View the source on GitHub".
//
// ⚠ THE HREF IS A DELIBERATE CARVE-OUT, NOT AN OVERSIGHT. github.com/mahilh/neotopia is a real repo
// and Mahil chose to keep the link. So the assertion is NOT "zero occurrences" · it is "exactly one,
// and it is the href". That makes this falsifiable in BOTH directions: re-adding prose reds it, and
// so does deleting the link. A one-directional gate here would let the link silently disappear.
//
// ── WHY THE COUNTERWEIGHTS ARE THE WHOLE FILE (Rule 80 · Rule 90) ────────────────────────────────
// ZERO IS THE PASS VALUE. That is the single most dangerous shape this project keeps meeting: a
// scanner pointed at a bad glob, a stripper that eats the line it should keep, a probe that reads an
// empty string · every one of them reports "no occurrences" and reads as health. award_game_win at 0
// rows, card art at 0/56 for fifteen sessions and the migrations counter at 0 were all this. So the
// instrument has to prove it MEASURED before its zero means anything, and both proofs come first:
//   A · it must consume the real tree  · files and bytes above a floor, checked against the glob
//   B · it must behave correctly on a fixture whose answer I control · and specifically it must NOT
//       eat a URL, because `https://` contains `//` and the naive line-comment strip would delete
//       the one occurrence this file exists to protect, turning the trap into a green.
//
// ── WHAT THIS FILE CAN AND CANNOT HOLD ───────────────────────────────────────────────────────────
// MEASURED THIS SESSION, and it is why a source scan is a fair proxy for the bundle: `npm run build`
// emits ONE chunk (622,631 bytes, byte-identical to the deployed asset), and comments are stripped ·
// 28 occurrences in src/ comments, 4 in the bundle, all four rendered strings. So there is no route
// whose strings live in a chunk the audit would miss, and no comment that survives to a reader.
// The brief's worry · "a string only rendered on another route would not have appeared" · is
// therefore false for this build, and the src/ scan below is belt-and-braces rather than the
// primary evidence. The primary evidence is the deployed bundle, re-read after the push.
//
// TEST FILES ARE EXCLUDED ON PURPOSE. Fixtures legitimately use the name as a player (`username:
// 'Mahil'`), and vitest files are never bundled · proven by the same build. The exclusion is
// asserted rather than assumed, because it is also what stops this file matching itself (Rule 89's
// corollary · a tool that scans the repo must exclude itself).

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import fs from 'node:fs'
import path from 'node:path'

vi.mock('../lib/supabase', () => ({
  supabase: {},
  GLOBAL_INDEX_BASE: 147823,
  getGlobalIndex: async () => 147823,
  getGlobalCivilizationTotal: async () => 0,
}))

const Landing = (await import('./Landing')).default
const mount = () => render(<MemoryRouter><Landing /></MemoryRouter>)
afterEach(cleanup)

const NAME = 'mahil'
const REPO_HREF = 'https://github.com/mahilh/neotopia'
const SRC = path.resolve(__dirname, '..')

// `https://` CONTAINS `//`, so a naive line-comment strip deletes the one occurrence this file
// exists to protect · a green on a page that still shows the name. The negative lookbehind is the
// whole defence and it is asserted below. Block comments go first so a URL inside one dies with it.
// NO SENTINEL: the first draft masked `://` with two NUL bytes, which are invisible in every editor
// and made grep treat this file as BINARY · it silently reported zero matches while I debugged.
const stripComments = (code) => code
  .replace(/\/\*[\s\S]*?\*\//g, ' ')   // block comments · covers {/* JSX */} too
  .replace(/(?<!:)\/\/[^\n]*/g, ' ')     // line comments · (?<!:) is what keeps https:// alive

const countName = (text) => (text.toLowerCase().match(new RegExp(NAME, 'g')) || []).length

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(jsx?|css)$/.test(e.name)) out.push(p)
  }
  return out
}

const scan = () => {
  const all = walk(SRC)
  const shipped = all.filter(f => !/\.test\.[jt]sx?$/.test(f))
  let bytes = 0
  const hits = []
  for (const f of shipped) {
    const code = fs.readFileSync(f, 'utf8')
    bytes += code.length
    const live = stripComments(code)
    if (countName(live) === 0) continue
    for (const line of live.split('\n')) {
      if (countName(line) > 0) hits.push({ file: path.relative(SRC, f), line: line.trim() })
    }
  }
  return { allFiles: all.length, shipped: shipped.length, excluded: all.length - shipped.length, bytes, hits }
}

// ── COUNTERWEIGHTS · FIRST, BECAUSE A BROKEN SCANNER AND A CLEAN REPO PRINT THE SAME NUMBER ──────

describe('the scanner can measure at all', () => {
  it('B · does NOT eat a URL, and DOES eat a comment · the fixture whose answer I control', () => {
    // THE TRAP THIS EXISTS FOR: `https://github.com/mahilh/neotopia` contains `//`. A naive
    // line-comment strip deletes from `//` to end of line, which removes the ONE occurrence this
    // file protects · and the gate would go green on a page that still displayed it.
    expect(countName(stripComments(`const a = "${REPO_HREF}"`)), 'the href must SURVIVE stripping').toBe(1)
    expect(countName(stripComments('// Mahil said so')), 'a line comment must be removed').toBe(0)
    expect(countName(stripComments('/* Mahil\n   said so */')), 'a block comment must be removed').toBe(0)
    expect(countName(stripComments('{/* Mahil said so */}')), 'a JSX comment must be removed').toBe(0)
    expect(countName(stripComments('<p>Mahil</p>')), 'JSX TEXT is not a comment and must survive').toBe(1)
    // And the strip must not corrupt what it keeps.
    expect(stripComments(`const a = "${REPO_HREF}" // note`).trim()).toBe(`const a = "${REPO_HREF}"`)
    // NOR LEAVE ANYTHING INVISIBLE BEHIND. The first draft masked `://` with two NUL bytes; they
    // survived into the committed source, where no editor shows them and `grep` quietly reclassified
    // the file as BINARY and reported zero matches for a string that was plainly there. An
    // instrument that hides characters is one that can hide an occurrence.
    // eslint-disable-next-line no-control-regex
    expect(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(stripComments(`"${REPO_HREF}" // x`)),
      'the stripper leaked a control character into its output').toBe(false)
  })

  it('A · actually consumed the tree · a zero from an empty scan is not a zero', () => {
    const r = scan()
    expect(r.allFiles, 'the glob matched nothing · every assertion below would be vacuous')
      .toBeGreaterThan(60)
    expect(r.bytes, 'files were found but read empty').toBeGreaterThan(200_000)
    expect(r.excluded, 'test files must be excluded ON PURPOSE · it is also what stops this file ' +
      'matching itself').toBeGreaterThan(20)
    expect(r.shipped).toBe(r.allFiles - r.excluded)
  })
})

// ── THE CLAIM ────────────────────────────────────────────────────────────────────────────────────

describe('the name does not appear in anything a player reads', () => {
  it('renders nowhere in the landing page text', () => {
    mount()
    // The rendered DOM, not the source · this is the surface a reader actually has.
    expect(countName(document.body.textContent)).toBe(0)
  })

  it('the footer link keeps its href and loses its label', () => {
    mount()
    const link = screen.getByRole('link', { name: /view the source/i })
    expect(link).toHaveAttribute('href', REPO_HREF)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    // FALSE CASE, and the reason this is not `toBe(0)` across the board: the link must still EXIST.
    // Deleting it would satisfy every other assertion in this file.
    expect(countName(link.textContent), 'the LABEL must not carry the name').toBe(0)
    expect(countName(link.getAttribute('href')), 'the HREF deliberately still does').toBe(1)
    // Rule 4 · it is a touch target and stays one.
    expect(parseInt(link.style.minHeight, 10)).toBeGreaterThanOrEqual(44)
  })

  it('appears in exactly one non-comment place in all of src · the href', () => {
    const { hits } = scan()
    const stray = hits.filter(h => !h.line.includes(REPO_HREF))
    expect(stray, `non-comment occurrences outside the href:\n` +
      stray.map(h => `  ${h.file} · ${h.line}`).join('\n')).toEqual([])
    expect(hits, 'the href itself must still be there · if this is empty the link was deleted')
      .toHaveLength(1)
    expect(hits[0].file).toBe('pages/Landing.jsx')
  })

  it('is not in index.html either · the one shipped file the src scan does not walk', () => {
    const html = fs.readFileSync(path.resolve(SRC, '../index.html'), 'utf8')
    expect(html.length, 'index.html read empty').toBeGreaterThan(100)
    expect(countName(html)).toBe(0)
  })
})

describe('the ideas the prose carried survive without the person', () => {
  it('still says the districts are meant to be built, and names the year', () => {
    mount()
    const purpose = screen.getByText(/rehearsing the construction/i)
    expect(purpose.textContent).toMatch(/2055/)
    expect(purpose.textContent).toMatch(/meant to stand on Earth/i)
  })

  it('still says five stages and that this game is the second', () => {
    mount()
    expect(screen.getByText(/five stages/i).textContent).toMatch(/second one/i)
  })

  it('still says the last stage is real land', () => {
    mount()
    expect(screen.getByText(/real\s+land, really bought/i)).toBeInTheDocument()
  })
})
