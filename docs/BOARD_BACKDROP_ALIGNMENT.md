# BOARD BACKDROP · why `board_terrain.png` is not wired, and exactly what would fix it

T1 S36 · August 9 2026 · **measured, not read**

## Verdict

`public/art/board/board_terrain.png` is a beautiful painting and it is **not a backdrop for this
board**. It fails the alignment gate on four independent counts, and three of them cannot be fixed
from the code side without changing the board itself.

It is not wired. The S35 terrain wash and motifs stay exactly as they are · there is nothing for
them to double-draw against.

The payload gate (gate 1) **passes comfortably** and is answered below with a real curve, so the day
a corrected image lands this is a ten-minute job rather than a session.

## How this was measured

The painted zones were isolated from the painting itself rather than eyeballed:

1. The PNG was resampled to BMP (no decoder to trust) and every pixel classified into
   water / grass / desert by palettes **read back off the image**, not guessed. The first pass
   assumed the water plateau was blue-dominant and classified **3 pixels out of 393,000** · the real
   samples are desert `226,188,111`, water `149,176,162`, grass `166,166,93`. Water is a desaturated
   teal whose GREEN channel leads. (Rule 75b · a probe is a claim.)
2. Each zone was then reduced to its **largest connected blob**, because a bare palette match also
   catches scattered landscape · the naive version gave water a 1200px-wide bounding box inside a
   1672px image, which is not a plateau, it is a colour that occurs elsewhere.
3. The board's own numbers come from `hexToPixel` at runtime, and its rendered size from the live
   DOM in a real browser at two viewport widths.
4. Every comparison in the payload curve has the master itself as a control. It scores **0.00**.

## The four mismatches

### 1 · The terrain arrangement is MIRRORED

| | water | grass | desert |
|---|---|---|---|
| painting (its own px) | 549, 584 | 1123, 568 | 831, **229** |
| board (svg user units) | 0, 0 | 432, 0 | 216, **436** |

In the painting the desert apex is **above** the water–grass baseline. On the board it is **below**.
Water is on the left and grass on the right in both, so this is a *reflection*, not a rotation:

- as-is → desert lands at the top, board needs it at the bottom
- rotated 180° → desert is right, but water and grass **swap sides**, which contradicts the terrain
  mapping Mahil confirmed live in S35 (WATER/Sacred City · GRASS/Living Earth · DESERT/Free Energy)
- mirrored horizontally → desert still at the top
- mirrored vertically → geometry works, and the painting is then **upside down**: every ridge shadow
  inverts and the mountains read as valleys

### 2 · The triangle is the wrong SHAPE

Normalised on the water–grass baseline:

```
painting   water-grass 1.000   water-desert 0.789   grass-desert 0.779
board      water-grass 1.000   water-desert 1.127   grass-desert 1.127
```

A 30% difference. Fit the painting to the board by pinning water and grass (scale 0.752, rotation
1.57°) and the painted desert zone lands at `219, -261` where the board wants `216, +436`. Even
granting the vertical flip that fixes mismatch 1, it is still **176 units out** · a board that is
only 758 units tall, so the desert zone misses its region by about two and a half hexes.

No rotation, uniform scale or reflection aligns all three zones at once. That is what "the triangles
are not similar" means, and it is the one measurement that settles this on its own.

### 3 · The painted hex lattice is rotated 30°

The painted cells are **pointy-top** · vertical edges left and right, a single vertex top and bottom.
NeoTopia's board is **flat-top** (`hexCorners`, angle `(π/3)·i`, first vertex at 0° = due right).

This is the S34 mistake, arriving this time inside the source art: every painted cell edge would
cross a real cell edge at 30°, in the one place a player is looking. It cannot be fixed by moving
anything · only by rotating the painting 30° (which re-breaks 1 and 2) or by rotating NeoTopia's
entire hex geometry, which is `hexToPixel` and therefore the game.

The good news, and it is worth saying because it is most of the work: the **cell size is right**.
The painted circumradius measures ~45 source px, which is 33.8 board units against `HEX_SIZE = 36`,
and each zone is a 19-cell radius-2 cluster, which is exactly a NeoTopia region.

### 4 · The canvas aspect is 16:9 and the board is nearly square

```
painting   1672 x 941   aspect 1.777
board      viewBox 828 x 866   aspect 0.956   (hex extent 720 x 758)
```

Behind a 0.956 board, a 1.777 image is either letterboxed to about half its area or cropped to lose
its left and right thirds · which is where its coastline and canyon live.

## Gate 1 · payload, answered anyway

The board's real rendered size, measured in the browser rather than assumed (the brief's "around
1200px wide" is high):

```
desktop 1440 viewport   board 715 x 748 css   ->  1430 device px at dpr2
phone    375 viewport   board 320 x 335 css   ->   960 device px at dpr3
```

So **1440 px is the source ceiling**, not 1600. Each candidate below was resampled INTO the 1430px
render width and compared to the master through the identical pipeline (the S29 card-art method):

```
candidate                   bytes   vs master   mean delta
1440px png                2013932       1.34x         3.41
1440px jpeg q90            448410       6.02x         4.07
1440px jpeg q80            357043       7.56x         4.17    <- recommended
1200px jpeg q80            260034      10.38x         4.31
 960px jpeg q80            173254      15.58x         4.84
 720px jpeg q80            100721      26.81x         5.63
master (1672 png)         2700938       1.00x         0.00    <- control
```

Read it the way S29 read the card curve: the **3.41 floor at 1440 lossless is resampler phase, not
damage** · a lossless resize cannot be losing information. JPEG at the same width adds only 0.66
over that floor while removing 82% of the bytes. Below 1200 the curve steepens, which is where
sufficiency actually ends.

**1440px JPEG q80 = 357 KB**, a 7.6x cut, covers a Retina desktop and a dpr3 phone from one file.
For scale: the whole JS bundle is 598 KB and the CSS is 43 KB. The master as shipped would have been
**4x the entire application**.

WebP would be smaller again and is not available: `sips` lists webp as readable but **not
Writable** on this machine, and there is no `cwebp`, `sharp` or `magick` installed. Same finding as
S29 · recorded again so nobody re-derives it.

## What a corrected image needs

Positions as fractions of the image, taken straight from the live viewBox
(`-198 -214.7 828 865.9`) so they land under the real hexes:

| zone | region | centre x | centre y |
|---|---|---|---|
| **water** | Sacred City | 23.9% | 24.8% |
| **grass** | Living Earth | 76.1% | 24.8% |
| **desert** | Free Energy | 50.0% | **75.2%** |
| compass rose | the junction | 50.0% | 41.6% |

- **Apex DOWN.** Desert at the bottom centre, water top-left, grass top-right. This is the single
  most important line in this document.
- **Aspect 0.956** (w/h). 1440 x 1506 is the natural delivery size. Not 16:9.
- **Flat-top hexes**: flat horizontal edges top and bottom, points at left and right. Rotate the
  lattice 30° from what is in the current painting.
- **19 cells per zone**, hexagonal cluster, cell circumradius **4.35% of image width** (36 of 828).
  The current art already has the cluster shape and roughly the right cell size · only the rotation
  is wrong.
- Zone circumradius **18.9% of image width** (156.9 of 828).
- Compass rose radius **under 9% of image width**, or it reaches the factory tap circles.
- Deliver as PNG at 1440 wide; the JPEG conversion is a build step, not the artist's job.

## Housekeeping done in the same pass

`public/art/board/` held 17 MB across six PNGs, none of them referenced anywhere in `src/`,
`tests/`, `public/`, `docs/`, `scripts/` or `.github/` (grepped, not assumed). Five were removed:

| file | why |
|---|---|
| `board_emblem.png` | the emblem Mahil removed in S35 · `BoardDepth.test.jsx` now asserts the centre stays empty |
| `board_bg.png` | superseded by `board_terrain.png` |
| `terrain_sacred_city.png` | dense photoreal city texture · fails the board's own "nothing may compete with a token" rule at token scale |
| `terrain_living_earth.png` | same |
| `terrain_free_energy.png` | same |

17 MB → 2.6 MB. They were **untracked**, so none of them had ever reached production · a local
`npm run build` was copying all 17 MB into `dist/`, and only that. Originals were copied to
`~/Portfolio/neotopia-board-art-unused/` before deletion, because untracked files have no git to
come back from; delete that folder to make it final.
