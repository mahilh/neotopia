// NeoTopia · terrain biome data · the visual identity of the 3 regions (T2 S10, for T1 S10 terrain visuals).
//
// Pure data · no logic, no engine state. T1 imports getBiomeForRegion(regionId) in the board layer and uses
// the colors as the hex fill / border / gradient for each region, giving the three regions distinct
// atmospheres with ZERO external image assets. The element colors mirror CLAUDE.md
// (Sacred City #7F77DD · Living Earth #1D9E75 · Free Energy #E24B4A) so terrain and tokens stay coherent.

export const TERRAIN_BIOMES = {
  'Sacred City': {
    regionId: 0,
    colors: {
      hex: '#1a1528',         // dark purple-midnight base (empty-hex fill)
      hexBorder: '#7F77DD',   // purple element color
      gradientFrom: '#1a1528',
      gradientTo: '#2d1f4e',
      accent: '#7F77DD',
    },
    label: 'Sacred City',
    atmosphere: 'desert dawn · crystal formations · ancient stone',
    svgPattern: 'diagonal-crystal',
  },
  'Living Earth': {
    regionId: 1,
    colors: {
      hex: '#0d1f14',         // dark forest base
      hexBorder: '#1D9E75',   // green element color
      gradientFrom: '#0d1f14',
      gradientTo: '#0f2a1c',
      accent: '#1D9E75',
    },
    label: 'Living Earth',
    atmosphere: 'lush bioregion · water channels · food forests',
    svgPattern: 'organic-dots',
  },
  'Free Energy': {
    regionId: 2,
    colors: {
      hex: '#1f0d0d',         // dark red-volcanic base
      hexBorder: '#E24B4A',   // red element color
      gradientFrom: '#1f0d0d',
      gradientTo: '#2e1010',
      accent: '#E24B4A',
    },
    label: 'Free Energy',
    atmosphere: 'volcanic coastal · wind arrays · tidal power',
    svgPattern: 'wave-lines',
  },
}

// Look up a biome by the engine's numeric regionId (0/1/2). Falls back to Sacred City so the board
// always has a defined fill even if an unexpected id is passed.
export const getBiomeForRegion = (regionId) =>
  Object.values(TERRAIN_BIOMES).find(b => b.regionId === regionId) || TERRAIN_BIOMES['Sacred City']
