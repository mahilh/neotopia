// scripts/bot-simulate.js
// NeoTopia autonomous bot simulation · finds bugs by playing the game
// Run: node scripts/bot-simulate.js
// Requires: npm run dev running on localhost:5173 OR set BOT_URL=https://neotopia.vercel.app
// Uses Playwright (already installed from T3 S6)

import { chromium } from '@playwright/test'
import { writeFileSync } from 'fs'
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
    // already has username from session
  }
  return page
}

async function doRandomAction(page, turn, errors) {
  try {
    const shouldPlace = Math.random() < 0.7

    if (shouldPlace) {
      const factories = await page.locator('[class*="factory"], [data-factory]').all()
      if (factories.length > 0) {
        const factory = factories[Math.floor(Math.random() * factories.length)]
        await factory.click({ timeout: 2000 }).catch(() => {})
        await delay(300)
        const validHexes = await page.locator('[class*="valid"], [class*="highlighted"], [data-valid="true"]').all()
        if (validHexes.length > 0) {
          const hex = validHexes[Math.floor(Math.random() * validHexes.length)]
          await hex.click({ timeout: 2000 }).catch(() => {})
          await delay(300)
          return 'placed-element'
        }
      }
    }

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
  log(`=== GAME ${gameNum} START ===`)
  const ctx1 = await browser.newContext({ storageState: undefined })
  const ctx2 = await browser.newContext({ storageState: undefined })
  const errors = []
  const moves = []
  const start = Date.now()

  try {
    const p1 = await getBotUsername(ctx1, `BotAlpha${gameNum}`)
    const p2 = await getBotUsername(ctx2, `BotBeta${gameNum}`)

    const createBtn = await p1.waitForSelector('button:has-text("Create Room")', { timeout: 8000 })
    await createBtn.click()
    await delay(1000)

    let roomCode = null
    try {
      const codeEl = await p1.waitForSelector('[style*="letter-spacing"][style*="monospace"], code, [class*="room-code"]', { timeout: 6000 })
      roomCode = (await codeEl.textContent()).trim().replace(/\s/g,'').slice(0,6)
      log(`Room: ${roomCode}`)
    } catch {
      const url = p1.url()
      const match = url.match(/[A-Z0-9]{6}/)
      if (match) roomCode = match[0]
      errors.push({ turn: 0, type: 'room-code-not-visible', message: 'Could not find room code element — copy button needed' })
    }

    if (!roomCode) throw new Error('No room code found')

    const joinBtn = await p2.waitForSelector('button:has-text("Join Room")', { timeout: 6000 })
    await joinBtn.click()
    const codeInput = await p2.waitForSelector('input[maxlength="6"], input[placeholder*="code" i]', { timeout: 5000 })
    await codeInput.fill(roomCode)
    await p2.click('button:has-text("Join")')
    await delay(1000)

    await p1.click('button:has-text("Ready")', { timeout: 5000 }).catch(e => errors.push({ turn:0, type:'ready-failed', message: e.message.slice(0,80) }))
    await p2.click('button:has-text("Ready")', { timeout: 5000 }).catch(e => errors.push({ turn:0, type:'ready-failed', message: e.message.slice(0,80) }))
    await delay(500)

    await p1.click('button:has-text("Start")', { timeout: 6000 }).catch(e => errors.push({ turn:0, type:'start-failed', message: e.message.slice(0,80) }))

    await p1.waitForURL(/\/game\//, { timeout: 15000 })
    await p2.waitForURL(/\/game\//, { timeout: 15000 })
    log('Both on game board')

    // Check for tutorial overlay
    const tutorialVisible = await p1.locator('text=/start building/i, text=/factory/i, text=/three actions/i').first().isVisible({ timeout: 3000 }).catch(() => false)
    if (!tutorialVisible) {
      errors.push({ turn: 0, type: 'no-tutorial', message: 'CRITICAL: Tutorial overlay missing — players will never learn to place elements (root cause of 0/0/0 playtest)' })
    } else {
      log('Tutorial visible — dismissing')
      await p1.locator('button:has-text(/got it|start building|skip/i)').first().click({ timeout: 3000 }).catch(() => {})
    }

    let turn = 0
    let gameEnded = false
    let stuckCount = 0

    while (turn < TURN_LIMIT && !gameEnded) {
      const page = turn % 2 === 0 ? p1 : p2
      const isMyTurn = await page.locator('text=/your turn/i').isVisible({ timeout: 1000 }).catch(() => false)

      if (!isMyTurn) {
        stuckCount++
        if (stuckCount > 20) {
          errors.push({ turn, type: 'stuck-state', message: `No player has turn after ${stuckCount} waits at turn ${turn}` })
          stuckCount = 0
        }
        await delay(300)
        continue
      }

      stuckCount = 0

      for (let a = 0; a < 3; a++) {
        const action = await doRandomAction(page, turn, errors)
        moves.push({ turn, action })
        await delay(200)
        const scored = await page.locator('[class*="score-flash"], [class*="scoreFlash"], [class*="score_flash"]').isVisible({ timeout: 500 }).catch(() => false)
        if (scored) log(`Turn ${turn} action ${a+1}: SCORED a district!`)
      }

      await page.click('button:has-text("End Turn")', { timeout: 3000 }).catch(() => {})
      await delay(600)
      turn++

      const finalScore = await p1.locator('text=/2055|civilization complete|final score/i').isVisible({ timeout: 500 }).catch(() => false)
      if (finalScore) {
        log(`Game ended at turn ${turn}`)
        gameEnded = true
      }
    }

    const placed = moves.filter(m => m.action === 'placed-element').length
    const drew = moves.filter(m => m.action === 'drew-card').length
    const result = {
      game: gameNum,
      completed: gameEnded,
      turns: turn,
      duration: Math.round((Date.now() - start) / 1000),
      errors: errors.length,
      totalMoves: moves.length,
      placedElements: placed,
      drewCards: drew,
      errorList: errors,
    }
    log(`Game ${gameNum}: ${turn} turns · placed ${placed} · drew ${drew} · ${errors.length} errors`)
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

  const browser = await chromium.launch({ headless: !HEADED, slowMo: HEADED ? 250 : 0 })
  const allResults = []

  for (let g = 1; g <= NUM_GAMES; g++) {
    const result = await playGame(g, browser)
    allResults.push(result)
    await delay(2000)
  }

  await browser.close()

  const report = {
    timestamp: new Date().toISOString(),
    url: BASE,
    games: NUM_GAMES,
    results: allResults,
    summary: {
      completed: allResults.filter(r => r.completed).length,
      totalErrors: allResults.reduce((s,r) => s + r.errors, 0),
      gamesWithElementPlacement: allResults.filter(r => r.placedElements > 0).length,
      totalElementsPlaced: allResults.reduce((s,r) => s + (r.placedElements || 0), 0),
      totalCardsDrawn: allResults.reduce((s,r) => s + (r.drewCards || 0), 0),
      errorTypes: {},
    }
  }

  allResults.flatMap(r => r.errorList || []).forEach(e => {
    report.summary.errorTypes[e.type] = (report.summary.errorTypes[e.type] || 0) + 1
  })

  const reportPath = `.bot-reports/report-${Date.now()}.json`
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log('\n=== BOT SIMULATION REPORT ===')
  console.log(`Games completed: ${report.summary.completed}/${NUM_GAMES}`)
  console.log(`Total errors: ${report.summary.totalErrors}`)
  console.log(`Games where elements placed: ${report.summary.gamesWithElementPlacement}/${NUM_GAMES}`)
  console.log(`Total elements placed: ${report.summary.totalElementsPlaced}`)
  console.log(`Total cards drawn: ${report.summary.totalCardsDrawn}`)
  console.log('Error breakdown:', report.summary.errorTypes)
  console.log(`Report: ${reportPath}`)

  const critical = allResults.flatMap(r => r.errorList || []).filter(e =>
    ['no-tutorial','stuck-state','fatal','room-code-not-visible'].includes(e.type)
  )
  if (critical.length > 0) {
    console.log('\nCRITICAL BUGS:')
    critical.forEach(e => console.log(` [${e.type}] ${e.message}`))
  } else {
    console.log('\nNo critical bugs found.')
  }

  return report
}

main().catch(err => {
  console.error('Bot simulation failed:', err.message)
  process.exit(1)
})
