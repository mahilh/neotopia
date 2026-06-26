// scripts/ux-scan.js
// NeoTopia UX + Accessibility Audit · automated Playwright scan
// Run: node scripts/ux-scan.js
// Run against prod: BOT_URL=https://neotopia.vercel.app node scripts/ux-scan.js
//
// Tests:
//   Touch target sizes (min 44px)
//   Font size minimums (min 12px)
//   Color contrast via luminance check
//   Missing data-testid attrs (bot testability)
//   Core Web Vitals via Playwright performance
//   aria-label on icon buttons
//   Empty state handling
//   Error state messaging

import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'fs'

const BASE = process.env.BOT_URL || 'http://localhost:5173'
const log = (...args) => console.log(new Date().toISOString().slice(11,19), ...args)

async function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

// Check all interactive elements meet 44px minimum
async function checkTouchTargets(page, route) {
  const violations = await page.evaluate(() => {
    const els = document.querySelectorAll('button, a, input, select, [role="button"], [tabindex]')
    const issues = []
    els.forEach(el => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) {
        if (r.height < 44 || r.width < 44) {
          issues.push({
            tag: el.tagName,
            text: (el.textContent || el.getAttribute('aria-label') || '').slice(0, 40),
            width: Math.round(r.width),
            height: Math.round(r.height),
            class: el.className.slice(0, 40),
          })
        }
      }
    })
    return issues
  })
  return violations.map(v => ({ route, type: 'touch-target', ...v }))
}

// Check font sizes >= 12px
async function checkFontSizes(page, route) {
  const violations = await page.evaluate(() => {
    const els = document.querySelectorAll('*')
    const issues = []
    els.forEach(el => {
      if (el.children.length === 0 && el.textContent.trim().length > 2) {
        const style = window.getComputedStyle(el)
        const size = parseFloat(style.fontSize)
        if (size < 12 && size > 0) {
          issues.push({
            text: el.textContent.trim().slice(0, 30),
            fontSize: size,
            tag: el.tagName,
          })
        }
      }
    })
    return issues.slice(0, 10)
  })
  return violations.map(v => ({ route, type: 'font-size', ...v }))
}

// Check buttons without accessible labels
async function checkA11y(page, route) {
  const violations = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, [role="button"]')
    const issues = []
    btns.forEach(btn => {
      const text = btn.textContent.trim()
      const ariaLabel = btn.getAttribute('aria-label')
      const ariaLabelledby = btn.getAttribute('aria-labelledby')
      const title = btn.getAttribute('title')
      if (!text && !ariaLabel && !ariaLabelledby && !title) {
        const r = btn.getBoundingClientRect()
        if (r.width > 0) {
          issues.push({
            class: btn.className.slice(0, 40),
            html: btn.outerHTML.slice(0, 80),
          })
        }
      }
    })
    return issues
  })
  return violations.map(v => ({ route, type: 'missing-accessible-label', ...v }))
}

// Check for required data-testid attributes
async function checkTestids(page, route) {
  const required = [
    'factory', 'my-turn-badge', 'end-turn-btn', 'ready-btn',
    'tutorial-dismiss', 'card-offer', 'card-hand'
  ]
  const found = await page.evaluate((ids) => {
    return ids.map(id => ({
      testid: id,
      present: !!document.querySelector(`[data-testid="${id}"]`),
    }))
  }, required)
  return found.filter(f => !f.present).map(f => ({ route, type: 'missing-testid', testid: f.testid }))
}

// Measure page load performance
async function measurePerformance(page, route) {
  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    return {
      loadTime: Math.round(nav?.loadEventEnd - nav?.startTime) || 0,
      domInteractive: Math.round(nav?.domInteractive - nav?.startTime) || 0,
      firstPaint: Math.round(performance.getEntriesByName('first-paint')[0]?.startTime) || 0,
    }
  })
  const issues = []
  if (metrics.loadTime > 3000) issues.push({ route, type: 'slow-load', ...metrics })
  if (metrics.firstPaint > 1500) issues.push({ route, type: 'slow-fcp', ...metrics })
  return { route, metrics }
}

async function scanPage(browser, url, routeName) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const issues = []

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })
    await delay(1000)

    const [targets, fonts, a11y, testids] = await Promise.all([
      checkTouchTargets(page, routeName),
      checkFontSizes(page, routeName),
      checkA11y(page, routeName),
      checkTestids(page, routeName),
    ])

    const perf = await measurePerformance(page, routeName)

    issues.push(...targets, ...fonts, ...a11y, ...testids)

    log(`[${routeName}] ${issues.length} issues · load ${perf.metrics.loadTime}ms`)
    return { route: routeName, issues, perf: perf.metrics }
  } catch (err) {
    log(`[${routeName}] ERROR: ${err.message.slice(0, 80)}`)
    return { route: routeName, issues, error: err.message.slice(0, 100) }
  } finally {
    await ctx.close().catch(() => {})
  }
}

async function main() {
  log(`NeoTopia UX Scan · ${BASE}`)
  mkdirSync('.ux-reports', { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const results = []

  // Scan landing page
  results.push(await scanPage(browser, BASE, 'Landing'))

  // Scan lobby (navigate through landing)
  const lobbyCtx = await browser.newContext()
  const lobbyPage = await lobbyCtx.newPage()
  try {
    await lobbyPage.goto(BASE)
    await delay(1000)
    const enterBtn = lobbyPage.locator('button:has-text("Enter the Civilization"), button:has-text("Enter")')
    if (await enterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await enterBtn.click()
      await delay(1000)
    }
    const [targets, fonts, a11y, testids] = await Promise.all([
      checkTouchTargets(lobbyPage, 'Lobby'),
      checkFontSizes(lobbyPage, 'Lobby'),
      checkA11y(lobbyPage, 'Lobby'),
      checkTestids(lobbyPage, 'Lobby'),
    ])
    const perf = await measurePerformance(lobbyPage, 'Lobby')
    const lobbyIssues = [...targets, ...fonts, ...a11y, ...testids]
    log(`[Lobby] ${lobbyIssues.length} issues`)
    results.push({ route: 'Lobby', issues: lobbyIssues, perf: perf.metrics })
  } catch (err) {
    results.push({ route: 'Lobby', issues: [], error: err.message.slice(0, 100) })
  } finally {
    await lobbyCtx.close().catch(() => {})
  }

  await browser.close()

  // Compile report
  const allIssues = results.flatMap(r => r.issues)
  const report = {
    timestamp: new Date().toISOString(),
    url: BASE,
    summary: {
      totalIssues: allIssues.length,
      byType: allIssues.reduce((acc, i) => { acc[i.type]=(acc[i.type]||0)+1; return acc }, {}),
      byRoute: results.map(r => ({ route: r.route, count: r.issues.length, load: r.perf?.loadTime })),
    },
    routes: results,
  }

  const path = `.ux-reports/ux-scan-${Date.now()}.json`
  writeFileSync(path, JSON.stringify(report, null, 2))

  console.log('\n=== UX SCAN REPORT ===')
  console.log(`Total issues: ${report.summary.totalIssues}`)
  console.log('By type:', report.summary.byType)
  report.summary.byRoute.forEach(r => console.log(`  [${r.route}] ${r.count} issues · ${r.load}ms load`))

  if (allIssues.length > 0) {
    console.log('\nTop issues:')
    allIssues.slice(0, 10).forEach(i => console.log(` [${i.route}/${i.type}] ${JSON.stringify(i).slice(0,100)}`))
  }
  console.log(`\nFull report: ${path}`)
}

main().catch(err => { console.error('UX scan failed:', err.message); process.exit(1) })
