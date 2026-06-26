// scripts/bot-simulate.js
// NeoTopia autonomous bot simulation · finds bugs by playing the game
//
// HOW TO RUN:
//   BOT_URL=https://neotopia.vercel.app node scripts/bot-simulate.js
//   BOT_HEADED=1 BOT_GAMES=1 node scripts/bot-simulate.js (visual debug)
//
// v4.2 — June 27 2026:
//   DIAGNOSIS: placed:0 despite turns working (v4/v4.1 fixed turn detection)
//   ROOT: factory/offer card selectors return empty arrays in production
//   FIX: full DOM diagnostic logging after board load + broader selectors
//   FIX: delay after factory click 400ms→1500ms + waitForSelector on valid hexes
//   FIX: page.evaluate to scan DOM for ALL testids on first turn (selector audit)

import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'fs'

const BASE = process.env.BOT_URL || 'http://localhost:5173'
const NUM_GAMES = parseInt(process.env.BOT_GAMES || '3')
const TURN_LIMIT = parseInt(process.env.BOT_TURNS || '30')
const HEADED = process.env.BOT_HEADED === '1'

const log = (...args) => console.log(new Date().toISOString().slice(11,19), ...args)
const delay = ms => new Promise(r => setTimeout(r, ms))

// ============================================================
// DOM DIAGNOSTIC (run once after board loads)
// Scans the live DOM and reports everything relevant.
// This tells us EXACTLY what selectors exist vs what we expected.
// ============================================================
async function diagnoseDom(page, label) {
  const info = await page.evaluate(() => {
    // All data-testid values in the DOM
    const allTestids = [...document.querySelectorAll('[data-testid]')]
      .map(el => el.getAttribute('data-testid'))
      .filter(Boolean)

    // All data-* attributes that might be game-related
    const gameAttrs = [...document.querySelectorAll('[data-factory],[data-valid],[data-my-turn],[data-offer],[data-game-phase]')]
      .map(el => ({
        tag: el.tagName,
        attrs: Object.fromEntries([...el.attributes].filter(a => a.name.startsWith('data-')).map(a => [a.name, a.value.slice(0, 30)])),
        class: el.className.toString().slice(0, 40),
      }))

    // Count of key selector results
    const factories = document.querySelectorAll('[data-testid="factory"],[data-factory]').length
    const validHexes = document.querySelectorAll('[data-valid="true"],[data-testid="hex-valid"]').length
    const offerByAttr = document.querySelectorAll('[data-offer]').length
    const offerByClass = document.querySelectorAll('[class*="offer" i],[class*="Offer"]').length
    const cardsByOffer = document.querySelectorAll('[data-offer] [class*="card"]').length
    const cardsByTestid = document.querySelectorAll('[data-testid="card-offer"]').length
    const myTurn = document.querySelectorAll('[data-my-turn="true"]').length
    const endTurn = document.querySelectorAll('[data-testid="end-turn-btn"]').length

    // Find any button-like elements in the game that might be factories or cards
    const allButtons = [...document.querySelectorAll('button,svg g[role="button"],g[tabindex],[role="button"]')]
      .filter(el => el.getBoundingClientRect().width > 0)
      .slice(0, 20)
      .map(el => ({ tag: el.tagName, class: el.className.toString().slice(0, 30), testid: el.getAttribute('data-testid') }))

    return {
      allTestids,
      gameAttrs,
      counts: { factories, validHexes, offerByAttr, offerByClass, cardsByOffer, cardsByTestid, myTurn, endTurn },
      buttonSample: allButtons,
      url: window.location.pathname,
    }
  })

  log(`[DOM-DIAG ${label}] testids: ${info.allTestids.join(', ')}`)
  log(`[DOM-DIAG ${label}] counts: factories=${info.counts.factories} validHex=${info.counts.validHexes} offer-attr=${info.counts.offerByAttr} offer-class=${info.counts.offerByClass} cardsByOffer=${info.counts.cardsByOffer} cardsByTestid=${info.counts.cardsByTestid} myTurn=${info.counts.myTurn} endTurn=${info.counts.endTurn}`)
  if (info.gameAttrs.length > 0) log(`[DOM-DIAG ${label}] game-attrs:`, JSON.stringify(info.gameAttrs.slice(0, 5)))
  log(`[DOM-DIAG ${label}] buttons:`, JSON.stringify(info.buttonSample.slice(0, 8)))

  return info
}

async function enterLobby(ctx, username) {
  const page = await ctx.newPage()
  await page.goto(BASE)
  await delay(1500)

  const enterBtns = [
    'button:has-text("Enter the Civilization")',
    'button:has-text("Enter")',
    'a:has-text("Enter the Civilization")',
  ]
  for (const sel of enterBtns) {
    const btn = page.locator(sel).first()
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      log(`[${username}] Landing page — clicking through`)
      await btn.click()
      await delay(1000)
      break
    }
  }

  const nameSelectors = [
    '[placeholder*="name" i]', '[placeholder*="username" i]',
    'input[type="text"]:visible', '[data-testid="username-input"]',
  ]
  for (const sel of nameSelectors) {
    const input = page.locator(sel).first()
    if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
      await input.fill(username)
      await input.press('Enter')
      await delay(600)
      log(`[${username}] Username set`)
      break
    }
  }
  return page
}

// ============================================================
// CORE ACTION — v4.2: diagnostic logging + broader selectors
// + 1500ms delay after factory click (was 400ms — too short for DOM render)
// + waitForSelector on valid hexes instead of .all()
// ============================================================
async function doRandomAction(page, turn, actionNum, errors, domDiag) {
  try {
    // FACTORY SELECTORS (ordered by specificity)
    const FACTORY_SELS = [
      '[data-testid="factory"]',
      '[data-factory]',
      // Broader fallbacks based on DOM diagnostic findings:
      'g[data-testid]',       // SVG group with any testid (might be factory)
      '[class*="factory" i]', // element with "factory" in class name
      'circle[r]',            // SVG circles (often used for factory tokens)
    ]

    if (Math.random() < 0.7) {
      let factories = []
      let foundSel = null
      for (const sel of FACTORY_SELS) {
        factories = await page.locator(sel).all()
        if (factories.length > 0) { foundSel = sel; break }
      }

      if (turn === 0 && actionNum === 0) {
        log(`[ACTION DIAG turn${turn}] factory selector '${foundSel}' → ${factories.length} elements`)
      }

      if (factories.length > 0) {
        await factories[Math.floor(Math.random() * factories.length)].click({ timeout: 2000, force: true }).catch(() => {})
        // v4.2: increased delay — game needs time to compute valid hexes after factory selection
        await delay(1500)

        // Wait for valid hexes to appear (up to 2 seconds)
        try {
          await page.locator('[data-valid="true"]').first().waitFor({ state: 'visible', timeout: 2000 })
        } catch { /* valid hexes may not appear if factory has no elements */ }

        const VALID_HEX_SELS = ['[data-valid="true"]', '[data-testid="hex-valid"]', '[class*="valid" i]']
        let validHexes = []
        for (const sel of VALID_HEX_SELS) {
          validHexes = await page.locator(sel).all()
          if (validHexes.length > 0) break
        }

        if (turn === 0 && actionNum === 0) {
          log(`[ACTION DIAG turn${turn}] valid-hex count: ${validHexes.length}`)
        }

        if (validHexes.length > 0) {
          await validHexes[Math.floor(Math.random() * validHexes.length)].click({ timeout: 2000, force: true }).catch(() => {})
          await delay(400)
          return 'placed-element'
        }
      }
    }

    // OFFER CARD SELECTORS (ordered by specificity)
    const CARD_SELS = [
      '[data-testid="card-offer"]',
      '[data-offer] [class*="card"]',
      '[class*="offer" i] [class*="card" i]',
      '[class*="Offer"] button',
      '[class*="offer" i] button',
      '[class*="hand" i] [class*="card" i]',  // try hand too
      '[class*="ProjectCard"]',
    ]

    let offerCards = []
    let offerSel = null
    for (const sel of CARD_SELS) {
      offerCards = await page.locator(sel).all()
      if (offerCards.length > 0) { offerSel = sel; break }
    }

    if (turn === 0 && actionNum === 0) {
      log(`[ACTION DIAG turn${turn}] offer selector '${offerSel}' → ${offerCards.length} elements`)
    }

    if (offerCards.length > 0) {
      await offerCards[Math.floor(Math.random() * offerCards.length)].click({ timeout: 2000, force: true }).catch(() => {})
      await delay(400)
      return 'drew-card'
    }

    // Last resort: use page.evaluate to find and click any game-interactive element
    if (domDiag && turn === 0 && actionNum === 0) {
      log('[ACTION DIAG] Both factory and card selectors returned 0 — game board missing testids. T1 must add data-testid="card-offer" to offer cards and data-offer to offer container.')
    }

    return 'no-action'
  } catch (err) {
    errors.push({ turn, type: 'action-error', message: err.message.slice(0, 100) })
    return 'error'
  }
}

async function dismissTutorial(page, label) {
  const tutorialSelectors = [
    '[data-testid="tutorial-skip"]', '[data-testid="tutorial-dismiss"]',
    'button:has-text("Start building the civilization")', 'button:has-text(/skip|got it/i)',
  ]
  for (const sel of tutorialSelectors) {
    const btn = page.locator(sel).first()
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click().catch(() => {})
      log(`Tutorial dismissed (${label})`)
      await delay(300)
      return true
    }
  }
  return false
}

async function detectActiveTurn(p1, p2) {
  const TURN_SELECTORS = [
    '[data-my-turn="true"]',
    '.my-turn-badge',
    'text=/your turn/i',
  ]
  for (const sel of TURN_SELECTORS) {
    const p1Active = await p1.locator(sel).first().isVisible({ timeout: 1800 }).catch(() => false)
    if (p1Active) return { page: p1, label: 'p1' }
    const p2Active = await p2.locator(sel).first().isVisible({ timeout: 1800 }).catch(() => false)
    if (p2Active) return { page: p2, label: 'p2' }
  }
  return null
}

async function extractRoomCode(page) {
  const classSelectors = ['[class*="room-code"]', '[class*="roomCode"]', '[class*="RoomCode"]', '[data-testid="room-code"]']
  for (const sel of classSelectors) {
    try {
      const el = await page.waitForSelector(sel, { timeout: 2000 })
      const text = (await el.textContent()).trim().replace(/\s/g, '')
      const match = text.match(/[A-Z0-9]{4,6}/)
      if (match) return match[0]
    } catch { /* continue */ }
  }
  try {
    const el = await page.waitForSelector('[style*="letter-spacing"][style*="monospace"], [style*="letter-spacing"] code, [style*="letter-spacing"] span', { timeout: 3000 })
    const text = (await el.textContent()).trim().replace(/\s/g, '')
    const match = text.match(/[A-Z0-9]{4,6}/)
    if (match) return match[0]
  } catch { /* continue */ }
  try {
    const el = await page.waitForSelector('code', { timeout: 2000 })
    const text = (await el.textContent()).trim().replace(/\s/g, '')
    const match = text.match(/[A-Z0-9]{4,6}/)
    if (match) return match[0]
  } catch { /* continue */ }
  try {
    const code = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      let node
      while ((node = walker.nextNode())) {
        const text = node.textContent.trim().replace(/\s/g, '')
        const match = text.match(/^[A-Z0-9]{6}$/)
        if (match) return match[0]
      }
      return null
    })
    if (code) return code
  } catch { /* continue */ }
  const urlMatch = page.url().match(/[A-Z0-9]{6}/)
  if (urlMatch) return urlMatch[0]
  return null
}

async function playGame(gameNum, browser) {
  log(`=== GAME ${gameNum} START ===`)
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const errors = []
  const moves = []
  const start = Date.now()
  const tag = Date.now().toString(36).slice(-5)

  try {
    const p1 = await enterLobby(ctx1, `BotAlpha${gameNum}_${tag}`)
    const p2 = await enterLobby(ctx2, `BotBeta${gameNum}_${tag}`)

    const createBtn = await p1.waitForSelector('button:has-text("Create Room"), button:has-text("Create")', { timeout: 10000 })
    await createBtn.click()
    await delay(1800)
    log(`[BotAlpha${gameNum}] Created room`)

    const roomCode = await extractRoomCode(p1)
    if (!roomCode || roomCode.length < 4) {
      errors.push({ turn: 0, type: 'room-code-not-visible', message: 'All extraction strategies failed' })
      throw new Error(`Bad room code: "${roomCode}"`)
    }
    log(`Room code: ${roomCode}`)

    const joinBtn = await p2.waitForSelector('button:has-text("Join Room"), button:has-text("Join")', { timeout: 8000 })
    await joinBtn.click()
    await delay(500)
    const codeInput = await p2.waitForSelector('input[maxlength="6"], input[placeholder*="code" i], input[placeholder*="room" i]', { timeout: 5000 })
    await codeInput.fill(roomCode)
    await p2.locator('button:has-text("Join")').last().click()
    await delay(1000)
    log(`[BotBeta${gameNum}] Joined ${roomCode}`)

    const readySelectors = ['[data-testid="ready-btn"]', 'button:has-text("Ready")', 'button:has-text("I\'m Ready")']
    for (const page of [p1, p2]) {
      for (const sel of readySelectors) {
        const btn = page.locator(sel).first()
        if (await btn.isVisible({ timeout: 2500 }).catch(() => false)) {
          await btn.click().catch(e => errors.push({ turn: 0, type: 'ready-failed', message: e.message.slice(0, 80) }))
          await delay(300)
          break
        }
      }
    }
    await delay(1000)

    await p1.locator('button:has-text("Start")').click({ timeout: 6000 }).catch(e =>
      errors.push({ turn: 0, type: 'start-failed', message: e.message.slice(0, 80) })
    )

    await p1.waitForURL(/\/game\//, { timeout: 15000 })
    await p2.waitForURL(/\/game\//, { timeout: 15000 })
    log('Both on game board')
    await delay(1500) // extra wait for full game state to sync from DB

    const [t1ok, t2ok] = await Promise.all([
      dismissTutorial(p1, 'host'),
      dismissTutorial(p2, 'joiner'),
    ])
    if (!t1ok && !t2ok) errors.push({ turn: 0, type: 'no-tutorial', message: 'Tutorial not dismissable' })
    await delay(800)

    // DOM DIAGNOSTIC — run once after game starts to see what elements exist
    log('Running DOM diagnostic...')
    const domDiag = await diagnoseDom(p1, 'p1-board')

    let turn = 0, gameEnded = false, stuckCount = 0
    while (turn < TURN_LIMIT && !gameEnded) {
      const active = await detectActiveTurn(p1, p2)
      if (!active) {
        stuckCount++
        if (stuckCount > 30) {
          errors.push({ turn, type: 'stuck-state', message: `No player has turn at turn ${turn}` })
          stuckCount = 0; turn++
        }
        await delay(400)
        continue
      }
      stuckCount = 0
      const { page: activePage, label } = active

      for (let a = 0; a < 3; a++) {
        const action = await doRandomAction(activePage, turn, a, errors, domDiag)
        moves.push({ turn, action, player: label })
        await delay(300)
      }

      await activePage.locator('[data-testid="end-turn-btn"], button:has-text("End Turn")').first()
        .click({ timeout: 3000 }).catch(() => {})
      await delay(1000) // allow DB sync + next turn render

      turn++
      const placedSoFar = moves.filter(m => m.action === 'placed-element').length
      const drewSoFar = moves.filter(m => m.action === 'drew-card').length
      log(`Turn ${turn} · ${label} · placed:${placedSoFar} · drew:${drewSoFar}`)

      const finished = await p1.locator('text=/final score|civilization complete|2055/i').isVisible({ timeout: 500 }).catch(() => false)
      if (finished) { log(`Game ${gameNum} complete at turn ${turn}`); gameEnded = true }
    }

    const placed = moves.filter(m => m.action === 'placed-element').length
    const drew = moves.filter(m => m.action === 'drew-card').length
    log(`Game ${gameNum}: ${turn} turns · placed ${placed} · drew ${drew} · ${errors.length} errors`)

    return { game: gameNum, completed: gameEnded, turns: turn,
      duration: Math.round((Date.now() - start) / 1000),
      errors: errors.length, placedElements: placed, drewCards: drew, errorList: errors }

  } catch (err) {
    errors.push({ turn: -1, type: 'fatal', message: err.message.slice(0, 200) })
    return { game: gameNum, completed: false, errors: errors.length + 1, errorList: errors, fatal: err.message.slice(0, 100) }
  } finally {
    await ctx1.close().catch(() => {})
    await ctx2.close().catch(() => {})
  }
}

async function main() {
  log(`NeoTopia Bot Simulation v4.2 · ${NUM_GAMES} games · ${BASE}`)
  log('v4.2: full DOM diagnostic · broader selectors · factory delay 400→1500ms · waitForSelector on valid hexes')
  mkdirSync('.bot-reports', { recursive: true })

  const browser = await chromium.launch({ headless: !HEADED, slowMo: HEADED ? 400 : 0 })
  const allResults = []
  for (let g = 1; g <= NUM_GAMES; g++) {
    allResults.push(await playGame(g, browser))
    await delay(2000)
  }
  await browser.close()

  const report = {
    timestamp: new Date().toISOString(), url: BASE, botVersion: 'v4.2',
    results: allResults,
    summary: {
      completed: allResults.filter(r => r.completed).length,
      totalErrors: allResults.reduce((s, r) => s + r.errors, 0),
      gamesWithPlacement: allResults.filter(r => r.placedElements > 0).length,
      totalPlaced: allResults.reduce((s, r) => s + (r.placedElements || 0), 0),
      totalDrew: allResults.reduce((s, r) => s + (r.drewCards || 0), 0),
      errorTypes: allResults.flatMap(r => r.errorList || [])
        .reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc }, {}),
    },
  }

  const reportPath = `.bot-reports/report-${Date.now()}.json`
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log('\n=== BOT SIMULATION REPORT (v4.2) ===')
  console.log(`Games completed: ${report.summary.completed}/${NUM_GAMES}`)
  console.log(`Elements placed: ${report.summary.totalPlaced} · Cards drawn: ${report.summary.totalDrew}`)
  console.log('Error types:', report.summary.errorTypes)
  console.log(`Report: ${reportPath}`)
  console.log('\nKEY: look for [DOM-DIAG] and [ACTION DIAG] lines above — they show why placed:0')
}

main().catch(err => { console.error('Bot failed:', err.message); process.exit(1) })
