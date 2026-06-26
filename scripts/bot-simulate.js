// scripts/bot-simulate.js
// NeoTopia autonomous bot simulation · finds bugs by playing the game
//
// HOW TO RUN (two terminal tabs):
//   Tab 1: npm run dev
//   Tab 2: node scripts/bot-simulate.js
//
// Or against production (no dev server needed):
//   BOT_URL=https://neotopia.vercel.app node scripts/bot-simulate.js
//
// Options:
//   BOT_GAMES=5  (default: 3)
//   BOT_TURNS=20 (default: 30)
//   BOT_HEADED=1 (watch it play in browser)

import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'fs'

const BASE = process.env.BOT_URL || 'http://localhost:5173'
const NUM_GAMES = parseInt(process.env.BOT_GAMES || '3')
const TURN_LIMIT = parseInt(process.env.BOT_TURNS || '30')
const HEADED = process.env.BOT_HEADED === '1'

const log = (...args) => console.log(new Date().toISOString().slice(11,19), ...args)
const delay = ms => new Promise(r => setTimeout(r, ms))

// Navigate through Landing page if present, then to lobby with username set
async function enterLobby(ctx, username) {
  const page = await ctx.newPage()
  await page.goto(BASE)
  await delay(1500)

  // Handle Landing page (T1 S7 shipped Landing.jsx at /)
  // Landing shows "Enter the Civilization" or similar CTA
  const onLanding = await page.locator(
    'button:has-text("Enter the Civilization"), button:has-text("Enter"), a:has-text("Enter the Civilization")'
  ).first().isVisible({ timeout: 3000 }).catch(() => false)

  if (onLanding) {
    log(`[${username}] Landing page detected — clicking through`)
    await page.locator(
      'button:has-text("Enter the Civilization"), button:has-text("Enter"), a:has-text("Enter the Civilization")'
    ).first().click()
    await delay(1000)
  }

  // Now on lobby — set username if field exists
  const nameInput = await page.locator(
    '[placeholder*="name" i], [placeholder*="username" i], input[type="text"]:visible'
  ).first()
  const nameVisible = await nameInput.isVisible({ timeout: 4000 }).catch(() => false)

  if (nameVisible) {
    await nameInput.fill(username)
    await nameInput.press('Enter')
    await delay(500)
  } else {
    log(`[${username}] No name input found — may already have username`)
  }

  return page
}

async function doRandomAction(page, turn, errors) {
  try {
    // 70% chance to place element (the action new players miss)
    if (Math.random() < 0.7) {
      const factories = await page.locator('[class*="factory"], [data-factory], [class*="Factory"]').all()
      if (factories.length > 0) {
        const factory = factories[Math.floor(Math.random() * factories.length)]
        await factory.click({ timeout: 2000 }).catch(() => {})
        await delay(400)
        const validHexes = await page.locator(
          '[class*="valid"], [class*="highlighted"], [data-valid="true"], [class*="hex--valid"]'
        ).all()
        if (validHexes.length > 0) {
          await validHexes[Math.floor(Math.random() * validHexes.length)].click({ timeout: 2000 }).catch(() => {})
          await delay(300)
          return 'placed-element'
        }
      }
    }

    // Draw a card from The Offer
    const offerCards = await page.locator(
      '[class*="offer"] [class*="card"], [data-offer] [class*="card"], [class*="Offer"] [class*="Card"]'
    ).all()
    if (offerCards.length > 0) {
      await offerCards[Math.floor(Math.random() * offerCards.length)].click({ timeout: 2000 }).catch(() => {})
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
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const errors = []
  const moves = []
  const start = Date.now()

  try {
    // Both bots navigate through landing and into lobby
    const p1 = await enterLobby(ctx1, `BotAlpha${gameNum}`)
    const p2 = await enterLobby(ctx2, `BotBeta${gameNum}`)

    // p1 creates room
    const createBtn = await p1.waitForSelector(
      'button:has-text("Create Room"), button:has-text("Create")',
      { timeout: 10000 }
    )
    await createBtn.click()
    await delay(1500)
    log(`[BotAlpha${gameNum}] Created room`)

    // Extract room code
    let roomCode = null
    try {
      const codeEl = await p1.waitForSelector(
        '[class*="room-code"], [class*="roomCode"], code, [style*="monospace"]',
        { timeout: 6000 }
      )
      const raw = (await codeEl.textContent()).trim().replace(/\s/g, '')
      roomCode = raw.match(/[A-Z0-9]{6}/)?.[0] || raw.slice(0, 6)
      log(`Room code: ${roomCode}`)
    } catch {
      // Try URL
      const match = p1.url().match(/[A-Z0-9]{6}/)
      if (match) roomCode = match[0]
      errors.push({ turn: 0, type: 'room-code-not-visible', message: 'Could not find room code display — copy button UX bug' })
    }

    if (!roomCode || roomCode.length < 4) {
      throw new Error(`Invalid room code: "${roomCode}" — lobby may not have loaded correctly`)
    }

    // p2 joins
    const joinBtn = await p2.waitForSelector(
      'button:has-text("Join Room"), button:has-text("Join")',
      { timeout: 8000 }
    )
    await joinBtn.click()
    await delay(500)
    const codeInput = await p2.waitForSelector(
      'input[maxlength="6"], input[placeholder*="code" i], input[placeholder*="room" i]',
      { timeout: 5000 }
    )
    await codeInput.fill(roomCode)
    await p2.locator('button:has-text("Join")').last().click()
    await delay(1000)
    log(`[BotBeta${gameNum}] Joined room ${roomCode}`)

    // Both ready up
    await p1.locator('button:has-text("Ready")').click({ timeout: 5000 }).catch(e =>
      errors.push({ turn:0, type:'ready-failed', message: e.message.slice(0,80) })
    )
    await p2.locator('button:has-text("Ready")').click({ timeout: 5000 }).catch(e =>
      errors.push({ turn:0, type:'ready-failed', message: e.message.slice(0,80) })
    )
    await delay(800)

    // p1 starts the game
    await p1.locator('button:has-text("Start")').click({ timeout: 6000 }).catch(e =>
      errors.push({ turn:0, type:'start-failed', message: e.message.slice(0,80) })
    )

    // Both navigate to game board
    await p1.waitForURL(/\/game\//, { timeout: 15000 })
    await p2.waitForURL(/\/game\//, { timeout: 15000 })
    log('Both on game board')

    // Check for tutorial overlay (T1 S8 task)
    const tutorialVisible = await p1.locator(
      'text=/start building/i, text=/three actions/i, text=/factory/i, text=/place.*element/i'
    ).first().isVisible({ timeout: 3000 }).catch(() => false)

    if (!tutorialVisible) {
      errors.push({
        turn: 0,
        type: 'no-tutorial',
        message: 'Tutorial overlay missing — players will only draw cards and score 0 (confirmed by June 26 playtest)'
      })
    } else {
      log('Tutorial visible — good!')
      await p1.locator('button:has-text(/got it|start building|skip/i)').first().click({ timeout: 3000 }).catch(() => {})
    }

    // Play the game
    let turn = 0
    let gameEnded = false
    let stuckCount = 0

    while (turn < TURN_LIMIT && !gameEnded) {
      const activePage = turn % 2 === 0 ? p1 : p2
      const isMyTurn = await activePage.locator(
        'text=/your turn/i, [class*="my-turn"], [class*="myTurn"]'
      ).first().isVisible({ timeout: 800 }).catch(() => false)

      if (!isMyTurn) {
        stuckCount++
        if (stuckCount > 30) {
          errors.push({ turn, type: 'stuck-state', message: `No player has turn after extended wait at turn ${turn}` })
          stuckCount = 0
          turn++ // force advance to avoid infinite loop
        }
        await delay(400)
        continue
      }

      stuckCount = 0

      // Do 3 actions per turn
      for (let a = 0; a < 3; a++) {
        const action = await doRandomAction(activePage, turn, errors)
        moves.push({ turn, action })
        await delay(250)

        const scored = await activePage.locator(
          '[class*="score-flash"], [class*="scoreFlash"], [class*="score_flash"]'
        ).isVisible({ timeout: 400 }).catch(() => false)
        if (scored) log(`Turn ${turn} action ${a+1}: SCORED a district!`)
      }

      await activePage.locator('button:has-text("End Turn")').click({ timeout: 3000 }).catch(() => {})
      await delay(700)
      turn++

      // Check game ended
      const finalScore = await p1.locator(
        'text=/2055|civilization complete|final score/i'
      ).isVisible({ timeout: 500 }).catch(() => false)
      if (finalScore) {
        log(`Game complete at turn ${turn}`)
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
  log(`Make sure dev server is running: npm run dev (separate terminal)`)
  mkdirSync('.bot-reports', { recursive: true })

  const browser = await chromium.launch({ headless: !HEADED, slowMo: HEADED ? 300 : 0 })
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
    results: allResults,
    summary: {
      completed: allResults.filter(r => r.completed).length,
      totalErrors: allResults.reduce((s,r) => s + r.errors, 0),
      gamesWithPlacement: allResults.filter(r => r.placedElements > 0).length,
      totalPlaced: allResults.reduce((s,r) => s + (r.placedElements||0), 0),
      totalDrew: allResults.reduce((s,r) => s + (r.drewCards||0), 0),
      errorTypes: allResults.flatMap(r => r.errorList||[])
        .reduce((acc,e) => { acc[e.type]=(acc[e.type]||0)+1; return acc }, {}),
    }
  }

  const reportPath = `.bot-reports/report-${Date.now()}.json`
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log('\n=== BOT SIMULATION REPORT ===')
  console.log(`Games completed: ${report.summary.completed}/${NUM_GAMES}`)
  console.log(`Total errors: ${report.summary.totalErrors}`)
  console.log(`Games with element placement: ${report.summary.gamesWithPlacement}/${NUM_GAMES}`)
  console.log(`Elements placed: ${report.summary.totalPlaced} · Cards drawn: ${report.summary.totalDrew}`)
  console.log(`Error types:`, report.summary.errorTypes)
  console.log(`Report: ${reportPath}`)

  const critical = allResults.flatMap(r => r.errorList||[])
    .filter(e => ['no-tutorial','stuck-state','fatal','room-code-not-visible'].includes(e.type))
  if (critical.length) {
    console.log('\nCRITICAL BUGS:')
    critical.forEach(e => console.log(` [${e.type}] ${e.message}`))
  } else {
    console.log('\nNo critical bugs found.')
  }
}

main().catch(err => {
  console.error('Bot simulation failed:', err.message)
  process.exit(1)
})
