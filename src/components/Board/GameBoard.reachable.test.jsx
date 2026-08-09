import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import GameBoard from './GameBoard'
import { REGIONS } from '../../utils/hexUtils'

afterEach(cleanup)

// ── Why this file exists ─────────────────────────────────────────────────────────────────────────
// Measured at 375px this session: after a player clicked a factory, the ONLY thing that changed on the
// board was a ring on the factory itself, and the panel that did respond was 381px away (651px at
// 1280). The board · the thing the player was looking at, because they had just clicked it · said
// nothing. The old tutorial then told them to "click any empty hex", which does nothing at all. Two
// real humans reached turn 4 on 2026-08-07, pressed End Turn three times, placed nothing and left.
//
// So the board now previews where the picked factory can reach. The guard below is not "a preview
// exists" · it is that the preview NEVER impersonates a placeable hex. Drawing an un-clickable hex the
// same way as a live target would repeat the exact promise the old copy broke.

const board = (props = {}) => render(
  <GameBoard
    regions={REGIONS.map(r => ({ ...r, hexes: {} }))}
    {...props}
  />,
)

// A real hex in region 0, taken from the geometry rather than invented, so the assertions below are
// about a cell the board actually renders.
const CENTER_0 = { q: REGIONS[0].cq, r: REGIONS[0].cr }

describe('GameBoard · the reachable preview', () => {
  it('draws nothing extra on a resting board', () => {
    const { container } = board()
    expect(container.querySelectorAll('[data-testid="hex-reachable"]')).toHaveLength(0)
    expect(container.querySelectorAll('.region-dimmed')).toHaveLength(0)
  })

  it('marks the hexes the picked factory can reach', () => {
    const { container } = board({ reachableTargets: [{ ...CENTER_0, regionId: 0 }] })
    const preview = container.querySelectorAll('[data-testid="hex-reachable"]')
    expect(preview).toHaveLength(1)
    // Dashed, because it is a preview. A solid ring is the language of "click me now".
    expect(preview[0].querySelector('polygon[stroke-dasharray]')).not.toBeNull()
  })

  it('never dresses a placeable hex as a preview, or a preview as placeable', () => {
    // THE HONESTY GUARD. The same hex handed in as BOTH: once an element and region are chosen this
    // cell really can take a token, and at that moment it must read as the live target and nothing
    // else · one hex, one meaning. A player who learns that dashed means "click me" learns it wrong.
    const { container } = board({
      reachableTargets: [{ ...CENTER_0, regionId: 0 }],
      validTargets: [CENTER_0],
    })
    expect(container.querySelectorAll('[data-testid="hex-valid"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-testid="hex-reachable"]')).toHaveLength(0)
  })

  it('fades only the regions the picked factory cannot serve', () => {
    const { container } = board({ reachableRegions: [0, 1] })
    const dimmed = [...container.querySelectorAll('[data-region-group].region-dimmed')]
      .map(g => Number(g.getAttribute('data-region-group')))
    expect(dimmed).toEqual([2])
  })

  it('reports a click on a preview hex, with the region it belongs to', () => {
    // Without this the preview is decoration: the player clicks what looks lit, nothing happens, and
    // they learn the board is dead · which is the failure this whole change exists to end.
    const onHexClick = vi.fn()
    const { container } = board({ reachableTargets: [{ ...CENTER_0, regionId: 0 }], onHexClick })
    fireEvent.click(container.querySelector('[data-testid="hex-reachable"]'))
    expect(onHexClick).toHaveBeenCalledWith(CENTER_0.q, CENTER_0.r, 0)
  })
})
