// scripts/bot-simulate.js
// NeoTopia autonomous bot simulation · finds bugs by playing the game
// Run: node scripts/bot-simulate.js
// Requires: npm run dev running on localhost:5173 OR set BOT_URL=https://neotopia.vercel.app
// Uses Playwright (already installed from T3 S6)

import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'fs'
import { mkdirSync } from 'fs'

const BASE = process.env.BOT_URL || 'http://localhost:5173'
const NUM_GAMES = parseInt(process.env.BOT_GAMES || '3')
const TURN_LIMIT = parseInt(process.env.BOT_TURNS || '30')
const HEADED = process.env.BOT_HEADED === '1'

const log = (...args) => console.log(new Date().toISOString().slice(11,19), ...args)

async function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

async function getBotUsername(ctx, username) {
  const page = await ctx.newPage()
  await page.goto(BASE)
  try {
    const nameInput = await page.waitForSelector('[placeholder*="name" i], [placeholder*="username" i]', { timeout: 10000 })
    await nameInput.fill(username)
    await nameInput.press('Enter')
  } catch {
    // already has username
  }
  return page
}

async function doRandomAction(page, isHost, turn, errors) {
  try {
    // Prioritize placing element (the action players miss): 70% chance
    const shouldPlace = Math.random() < 0.7

    if (shouldPlace) {
      // Try to click a factory element
      const factories = await page.locator('[class*="factory"], [data-factory]').all()
      if (factories.length > 0) {
        const factory = factories[Math.floor(Math.random() * factories.length)]
        await factory.click({ timeout: 2000 }).catch(() => {})
        await delay(300)

        // Then click a valid hex on the board
        const validHexes = await page.locator('[class*="valid"], [class*="highlighted"], [data-valid="true"]').all()
        if (validHexes.length > 0) {
          const hex = validHexes[Math.floor(Math.random() * validHexes.length)]
          await hex.click({ timeout: 2000 }).catch(() => {})
          await delay(300)
          return 'placed-element'
        }
      }
    }

    // Fallback: draw a card from The Offer
    const offerCards = await page.locator('[class*="offer"] [class*="card"], [data-offer] [class*="card"]').all()
    if (offerCards.length > 0) {
      const card = offerCards[Math.floor(Math.random() * offerCards.length)]
      await card.click({ timeout: 2000 }).catch(() => {})
      await delay(300)
      return 'drew-card'
    }

    return 'no-action'
  } catch (err) {
    errors.push({ turn, type: 'action-error', message: err.message.slice(0, 100) })
    return 'error'
  }
}

async function playGame(gameNum, browser) {
  log(`\n=== GAME ${gameNum} START ===')
  const ctx1 = await browser.newContext({ storageState: undefined })
  const ctx2 = await browser.newContext({ storageState: undefined })
  const errors = []
  const moves = []
  const start = Date.now()

  try {
    // Both bots enter
    const p1 = await getBotUsername(ctx1, `BotAlpha${gameNum}`)
    const p2 = await getBotUsername(ctx2, `BotBeta${gameNum}`)

    // p1 creates room
    const createBtn = await p1.waitForSelector('button:has-text("Create Room")', { timeout: 8000 })
    await createBtn.click()
    await delay(1000)

    // Get room code
    let roomCode = null
    try {
      const codeEl = await p1.waitForSelector('[style*="letter-spacing"][style*="monospace"], code, [class*="room-code"]', { timeout: 6000 })
      roomCode = (await codeEl.textContent()).trim().replace(/\s/g,'').slice(0,6)
      log(`Room: ${roomCode}`)
    } catch {
      // Try extracting from URL or input
      const url = p1.url()
      const match = url.match(/[A-Z0-9]{6}/)
      if (match) roomCode = match[0]
      errors.push({ turn: 0, type: 'room-code-not-visible', message: 'Could not find room code element' })
    }

    if (!roomCode) throw new Error('No room code found')

    // p2 joins
    const joinBtn = await p2.waitForSelector('button:has-text("Join Room")', { timeout: 6000 })
    await joinBtn.click()
    const codeInput = await p2.waitForSelector('input[maxlength="6"], input[placeholder*="code" i]', { timeout: 5000 })
    await codeInput.fill(roomCode)
    await p2.click('button:has-text("Join")')
    await delay(1000)

    // Both ready
    await p1.click('button:has-text("Ready")', { timeout: 5000 }).catch(e => errors.push({ turn:0, type:'ready-failed', message: e.message.slice(0,80) }))
    await p2.click('button:has-text("Ready")', { timeout: 5000 }).catch(e => errors.push({ turn:0, type:'ready-failed', message: e.message.slice(0,80) }))
    await delay(500)

    // p1 starts
    await p1.click('button:has-text("Start")', { timeout: 6000 }).catch(e => errors.push({ turn:0, type:'start-failed', message: e.message.slice(0,80) }))

    // Wait for game board
    await p1.waitForURL(/\/game\//, { timeout: 15000 })
    await p2.waitForURL(/\/game\//, { timeout: 15000 })
    log('Both on game board')

    // Check for tutorial overlay (BUG if missing)
    const tutorialVisible = await p1.locator('text=/start building/i, text=/tutorial/i, text=/factory/i').isVisible().catch(() => false)
    if (!tutorialVisible) {
      errors.push({ turn: 0, type: 'no-tutorial', message: 'Tutorial overlay not shown on first turn — players will not know how to place elements' })
    }

    // Dismiss tutorial if present
    const tutorialBtn = await p1.locator('button:has-text(/got it|start building|skip/i)').first()
    if (await tutorialBtn.isVisible().catch(() => false)) {
      await tutorialBtn.click()
    }

    // Play turns
    let turn = 0
    let gameEnded = false
    while (turn < TURN_LIMIT && !gameEnded) {
      const page = turn % 2 === 0 ? p1 : p2
      const isMyTurn = await page.locator('text=/your turn/i').isVisible().catch(() => false)

      if (!isMyTurn) {
        await delay(500)
        continue
      }

      // Do 3 actions
      for (let a = 0; a < 3; a++) {
        const action = await doRandomAction(page, turn % 2 === 0, turn, errors)
        moves.push({ turn, action })
        await delay(200)

        // Check for score flash (scoring worked!)
        const scored = await page.locator('[class*="score-flash"], [class*="scoreFlash"]').isVisible().catch(() => false)
        if (scored) log(`Turn ${turn}: SCORED!`)
      }

      // End turn
      await page.click('button:has-text("End Turn")', { timeout: 3000 }).catch(() => {})
      await delay(500)
      turn++

      // Check if game ended
      const finalScore = await p1.locator('text=/2055|civilization complete/i').isVisible().catch(() => false)
      if (finalScore) {
        log(`Game ended at turn ${turn}`)
        gameEnded = true
      }

      // Check for stuck state (no turn change after 10 waits)
      if (turn > 5) {
        const p1Turn = await p1.locator('text=/your turn/i').isVisible().catch(() => false)
        const p2Turn = await p2.locator('text=/your turn/i').isVisible().catch(() => false)
        if (!p1Turn && !p2Turn) {
          errors.push({ turn, type: 'stuck-state', message: 'No player shows Your Turn — game may be stuck' })
        }
      }
    }

    // Check final scores
    const p1Score = await p1.locator('[class*="score"], [class*="region"]').allTextContents().catch(() => [])
    const p2Score = await p2.locator('[class*="score"], [class*="region"]').allTextContents().catch(() => [])

    const result = {
      game: gameNum,
      completed: gameEnded,
      turns: turn,
      duration: Date.now() - start,
      errors: errors.length,
      moves: moves.length,
      errorList: errors,
      scored: moves.filter(m => m.action === 'placed-element').length > 0,
    }
    log(`Game ${gameNum} done: ${turn} turns · ${errors.length} errors · placed elements: ${result.scored}`)
    return result

  } catch (err) {
    errors.push({ turn: -1, type: 'fatal', message: err.message.slice(0, 200) })
    return { game: gameNum, completed: false, errors: errors.length + 1, errorList: errors, fatal: err.message.slice(0, 100) }
  } finally {
    await ctx1.close().catch(() => {})
    await ctx2.close().catch(() => {})
  }
}

async function main() {
  log(`NeoTopia Bot Simulation · ${NUM_GAMES} games · ${BASE}`)
  mkdirSync('.bot-reports', { recursive: true })

  const browser = await chromium.launch({ headless: !HEADED, slowMo: HEADED ? 200 : 0 })
  const allResults = []

  for (let g = 1; g <= NUM_GAMES; g++) {
    const result = await playGame(g, browser)
    allResults.push(result)
    await delay(2000) // brief pause between games
  }

  await browser.close()

  // Report
  const report = {
    timestamp: new Date().toISOString(),
    url: BASE,
    games: NUM_GAMES,
    results: allResults,
    summary: {
      completed: allResults.filter(r => r.completed).length,
      totalErrors: allResults.reduce((s,r) => s + r.errors, 0),
      placedElements: allResults.filter(r => r.scored).length,
      errorTypes: {},
    }
  }

  // Count error types
  allResults.flatMap(r => r.errorList || []).forEach(e => {
    report.summary.errorTypes[e.type] = (report.summary.errorTypes[e.type] || 0) + 1
  })

  const reportPath = `.bot-reports/report-${Date.now()}.json`
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log('\n=== BOT SIMULATION REPORT ===')
  console.log(`Games: ${report.summary.completed}/${NUM_GAMES} completed`)
  console.log(`Total errors: ${report.summary.totalErrors}`)
  console.log(`Games where elements were placed: ${report.summary.placedElements}/${NUM_GAMES}`)
  console.log('Error breakdown:', report.summary.errorTypes)
  console.log(`Full report: ${reportPath}`)

  // Print critical bugs
  const critical = allResults.flatMap(r => r.errorList || []).filter(e =>
    ['no-tutorial','stuck-state','fatal','room-code-not-visible'].includes(e.type)
  )
  if (critical.length > 0) {
    console.log('\n❌ CRITICAL BUGS:')
    critical.forEach(e => console.log(` [${e.type}] ${e.message}`))
  }

  return report
}

main().catch(err => {
  console.error('Bot simulation failed:', err.message)
  process.exit(1)
})
