// 56 NeoTopia Project Cards.
// Each card: id, name, pattern [{q,r,type}], points, illustration, district, description.
// Counts: 12 x 2pt, 18 x 3pt, 18 x 4pt, 8 x 5pt = 56.
// `illustration` drives Diverse City enforcement (cannot build same illustration
// consecutively in one region) · there must be 3+ distinct illustration values.

export const PROJECT_CARDS = [
  // 2-ELEMENT CARDS (12 cards, 2pts)
  {
    id: 'card_01', name: 'Fibonacci Solar Terrace',
    pattern: [{ q: 0, r: 0, type: 'energy' }, { q: 1, r: 0, type: 'energy' }],
    points: 2, illustration: 'garden', district: 4,
    description: 'Sunlight arranged in living spirals, feeding the district from above.',
  },
  {
    id: 'card_02', name: 'Mycelium Data Farm',
    pattern: [{ q: 0, r: 0, type: 'biofarming' }, { q: 0, r: 1, type: 'biofarming' }],
    points: 2, illustration: 'network', district: 5,
    description: 'Underground intelligence threading the living earth beneath every building.',
  },
  {
    id: 'card_03', name: 'Resonance Crossing',
    pattern: [{ q: 0, r: 0, type: 'technology' }, { q: 1, r: -1, type: 'technology' }],
    points: 2, illustration: 'bridge', district: 7,
    description: 'Two frequencies meet and become coherent: the first step in any civilization.',
  },
  {
    id: 'card_04', name: 'Council Ring',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 0, r: 1, type: 'community' }],
    points: 2, illustration: 'circle', district: 1,
    description: 'The oldest governance technology: nine people in a circle, listening.',
  },
  {
    id: 'card_05', name: 'Copper Arc Substation',
    pattern: [{ q: 0, r: 0, type: 'energy' }, { q: 0, r: 1, type: 'technology' }],
    points: 2, illustration: 'node', district: 7,
    description: 'Copper, plasma and patience: the quiet machinery that keeps a district lit.',
  },
  {
    id: 'card_06', name: 'Community Seed Bank',
    pattern: [{ q: 0, r: 0, type: 'biofarming' }, { q: 1, r: -1, type: 'community' }],
    points: 2, illustration: 'vault', district: 5,
    description: 'Before cities: seeds. Every civilization that lasted kept a room like this one.',
  },
  {
    id: 'card_07', name: 'Mineral Springs Baths',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 1, r: 0, type: 'biofarming' }],
    points: 2, illustration: 'pool', district: 2,
    description: 'Water charged with intention is the oldest medicine still working.',
  },
  {
    id: 'card_08', name: 'Shared Battery Hall',
    pattern: [{ q: 0, r: 0, type: 'energy' }, { q: 0, r: 1, type: 'community' }],
    points: 2, illustration: 'terminal', district: 4,
    description: 'Power the whole district owns together, stored for the hours the sun is gone.',
  },
  {
    id: 'card_09', name: 'Data Grove',
    pattern: [{ q: 0, r: 0, type: 'technology' }, { q: 0, r: 1, type: 'biofarming' }],
    points: 2, illustration: 'grove', district: 7,
    description: 'A living computer. The forest keeps the record, and the record keeps growing.',
  },
  {
    id: 'card_10', name: 'Helios Source Spring',
    pattern: [{ q: 0, r: 0, type: 'energy' }, { q: 1, r: -1, type: 'biofarming' }],
    points: 2, illustration: 'spring', district: 5,
    description: 'Sun feeds water feeds earth: an unbroken sacred loop, three elements as one.',
  },
  {
    id: 'card_11', name: 'Open Source Workshop',
    pattern: [{ q: 0, r: 0, type: 'technology' }, { q: 1, r: 0, type: 'community' }],
    points: 2, illustration: 'commons', district: 8,
    description: 'Share the code. Share the light. No knowledge is private in NeoTopia.',
  },
  {
    id: 'card_12', name: 'Rooftop Wind Array',
    pattern: [{ q: 0, r: 0, type: 'energy' }, { q: -1, r: 1, type: 'energy' }],
    points: 2, illustration: 'weave', district: 4,
    description: 'Invisible force made audible. The wind has always been transmitting.',
  },

  // 3-ELEMENT CARDS (18 cards, 3pts)
  {
    id: 'card_13', name: 'Sacred Geometry Park',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 1, r: 0, type: 'community' }, { q: 0, r: 1, type: 'technology' }],
    points: 3, illustration: 'park', district: 6,
    description: 'Space itself can be a teacher when designed with sacred mathematics.',
  },
  {
    id: 'card_14', name: 'Living Earth Collective',
    pattern: [{ q: 0, r: 0, type: 'biofarming' }, { q: 1, r: 0, type: 'biofarming' }, { q: 1, r: -1, type: 'biofarming' }],
    points: 3, illustration: 'farm', district: 5,
    description: 'Three growing things: three generations of memory in regenerated soil.',
  },
  {
    id: 'card_15', name: 'Wireless Power Tower',
    pattern: [{ q: 0, r: 0, type: 'technology' }, { q: 0, r: 1, type: 'technology' }, { q: 0, r: 2, type: 'energy' }],
    points: 3, illustration: 'tower', district: 7,
    description: 'Energy rises from earth to sky, carried on frequencies we are learning to read.',
  },
  {
    id: 'card_16', name: 'Healing Sanctuary',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 1, r: 0, type: 'biofarming' }, { q: 1, r: -1, type: 'community' }],
    points: 3, illustration: 'sanctuary', district: 2,
    description: 'The body heals fastest in spaces designed for healing.',
  },
  {
    id: 'card_17', name: 'Solar Updraft Tower',
    pattern: [{ q: 0, r: 0, type: 'energy' }, { q: 1, r: 0, type: 'energy' }, { q: 2, r: 0, type: 'energy' }],
    points: 3, illustration: 'spire', district: 4,
    description: 'Three aligned sources create a harmonic that neither one could produce alone.',
  },
  {
    id: 'card_18', name: 'Meditation Hall',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 1, r: 0, type: 'community' }, { q: 0, r: 1, type: 'biofarming' }],
    points: 3, illustration: 'hall', district: 1,
    description: 'Still minds change everything. One room changes a district.',
  },
  {
    id: 'card_19', name: 'Orbital Uplink Station',
    pattern: [{ q: 0, r: 0, type: 'technology' }, { q: 1, r: -1, type: 'technology' }, { q: 0, r: 1, type: 'energy' }],
    points: 3, illustration: 'observatory', district: 7,
    description: 'We built telescopes to see the stars. Now we build instruments to see ourselves.',
  },
  {
    id: 'card_20', name: 'Food Forest',
    pattern: [{ q: 0, r: 0, type: 'biofarming' }, { q: 0, r: 1, type: 'biofarming' }, { q: 1, r: 0, type: 'community' }],
    points: 3, illustration: 'forest', district: 5,
    description: 'A forest that feeds you is a civilization that loves you.',
  },
  {
    id: 'card_21', name: 'Solarpunk Atrium',
    pattern: [{ q: 0, r: 0, type: 'energy' }, { q: 0, r: 1, type: 'biofarming' }, { q: 1, r: 0, type: 'community' }],
    points: 3, illustration: 'atrium', district: 6,
    description: 'Glass, light, plants, people: the four elements of a living building.',
  },
  {
    id: 'card_22', name: 'Acoustic Pavilion',
    pattern: [{ q: 0, r: 0, type: 'technology' }, { q: 1, r: 0, type: 'community' }, { q: 0, r: 1, type: 'community' }],
    points: 3, illustration: 'gate', district: 1,
    description: 'Some thresholds are made of vibration. You pass through by becoming coherent.',
  },
  {
    id: 'card_23', name: 'Free Energy Lab',
    pattern: [{ q: 0, r: 0, type: 'energy' }, { q: 1, r: 0, type: 'technology' }, { q: 1, r: -1, type: 'energy' }],
    points: 3, illustration: 'lab', district: 4,
    description: "My grandfather's dream. The invention that cannot be suppressed.",
  },
  {
    id: 'card_24', name: 'Crystal Academy',
    pattern: [{ q: 0, r: 0, type: 'technology' }, { q: 0, r: 1, type: 'community' }, { q: 1, r: -1, type: 'biofarming' }],
    points: 3, illustration: 'academy', district: 3,
    description: 'Knowledge organized around the soul, not the exam.',
  },
  {
    id: 'card_25', name: 'Mycelium Intelligence Dome',
    pattern: [{ q: 0, r: 0, type: 'biofarming' }, { q: 1, r: -1, type: 'biofarming' }, { q: 0, r: 1, type: 'technology' }],
    points: 3, illustration: 'dome', district: 5,
    description: 'The first building material that answers back. Grown, not manufactured. Alive, not inert.',
  },
  {
    id: 'card_26', name: 'Star Chart Institute',
    pattern: [{ q: 0, r: 0, type: 'technology' }, { q: 1, r: 0, type: 'energy' }, { q: -1, r: 1, type: 'community' }],
    points: 3, illustration: 'starmap', district: 9,
    description: 'To know where we are in the galaxy is to know what we are responsible for.',
  },
  {
    id: 'card_27', name: 'Sound Therapy Hall',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 0, r: 1, type: 'energy' }, { q: 1, r: -1, type: 'community' }],
    points: 3, illustration: 'chamber', district: 2,
    description: 'Frequency made visible becomes sacred geometry. The body recognizes its origin.',
  },
  {
    id: 'card_28', name: 'City Memory Archive',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 1, r: 0, type: 'technology' }, { q: 2, r: 0, type: 'biofarming' }],
    points: 3, illustration: 'archive', district: 8,
    description: 'A civilization chooses what to remember. These walls hold what matters.',
  },
  {
    id: 'card_29', name: 'Consciousness Hub',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 0, r: 1, type: 'community' }, { q: 1, r: -1, type: 'technology' }],
    points: 3, illustration: 'hub', district: 1,
    description: 'Connection is not a product. It is the civilization.',
  },
  {
    id: 'card_30', name: 'Seed Library',
    pattern: [{ q: 0, r: 0, type: 'biofarming' }, { q: -1, r: 1, type: 'biofarming' }, { q: 1, r: 0, type: 'community' }],
    points: 3, illustration: 'library', district: 5,
    description: 'A seed is a compressed universe. We keep universes here, organized by memory.',
  },

  // 4-ELEMENT CARDS (18 cards, 4pts)
  {
    id: 'card_31', name: 'Bladeless Turbine',
    pattern: [{ q: 0, r: 0, type: 'energy' }, { q: 1, r: 0, type: 'community' }, { q: 1, r: -1, type: 'energy' }, { q: 0, r: 1, type: 'community' }],
    points: 4, illustration: 'temple', district: 1,
    description: 'No blades, no noise, nothing for a bird to hit. The wind gives everything and takes nothing back.',
  },
  {
    id: 'card_32', name: 'Alien Contact Embassy',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 1, r: 0, type: 'technology' }, { q: 0, r: 1, type: 'community' }, { q: 1, r: -1, type: 'technology' }],
    points: 4, illustration: 'embassy', district: 9,
    description: 'A civilization ready for contact with the unknown is a civilization ready for itself.',
  },
  {
    id: 'card_33', name: 'Hologram Lab',
    pattern: [{ q: 0, r: 0, type: 'technology' }, { q: 1, r: 0, type: 'technology' }, { q: 0, r: 1, type: 'community' }, { q: 1, r: -1, type: 'energy' }],
    points: 4, illustration: 'campus', district: 7,
    description: "Bohm's implicate order made visible: the universe unfolds from this room.",
  },
  {
    id: 'card_34', name: 'Soil Restoration Field',
    pattern: [{ q: 0, r: 0, type: 'biofarming' }, { q: 1, r: 0, type: 'biofarming' }, { q: 0, r: 1, type: 'biofarming' }, { q: 1, r: -1, type: 'energy' }],
    points: 4, illustration: 'field', district: 5,
    description: 'Four seasons of patient farming restore what centuries of extraction took.',
  },
  {
    id: 'card_35', name: 'Community Water Tower',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 0, r: 1, type: 'biofarming' }, { q: 1, r: 0, type: 'energy' }, { q: 0, r: 2, type: 'community' }],
    points: 4, illustration: 'tower', district: 5,
    description: 'Water carries memory. A NeoTopian water tower carries intention.',
  },
  {
    id: 'card_36', name: 'Hempcrete District',
    pattern: [{ q: 0, r: 0, type: 'biofarming' }, { q: 1, r: 0, type: 'biofarming' }, { q: 1, r: -1, type: 'community' }, { q: 0, r: 1, type: 'community' }],
    points: 4, illustration: 'district', district: 6,
    description: 'Buildings grown from the earth must return to it. Architecture as regeneration.',
  },
  {
    id: 'card_37', name: 'Community Radio Tower',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 1, r: 0, type: 'technology' }, { q: 2, r: 0, type: 'community' }, { q: 1, r: 1, type: 'community' }],
    points: 4, illustration: 'studio', district: 8,
    description: 'What you transmit becomes the frequency of the district. Choose carefully.',
  },
  {
    id: 'card_38', name: 'Pyramid Power Plant',
    pattern: [{ q: 0, r: 0, type: 'energy' }, { q: 1, r: 0, type: 'technology' }, { q: 0, r: 1, type: 'technology' }, { q: 1, r: -1, type: 'energy' }],
    points: 4, illustration: 'pyramid', district: 4,
    description: 'Ancient structure. Modern understanding. My grandfather stood here first.',
  },
  {
    id: 'card_39', name: 'Council of Nine',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 1, r: 0, type: 'community' }, { q: 0, r: 1, type: 'technology' }, { q: -1, r: 1, type: 'community' }],
    points: 4, illustration: 'chamber', district: 1,
    description: 'Nine seats. Nine principles. No decision leaves this room without all nine.',
  },
  {
    id: 'card_40', name: 'Biogas Plant',
    pattern: [{ q: 0, r: 0, type: 'biofarming' }, { q: 1, r: 0, type: 'energy' }, { q: 0, r: 1, type: 'energy' }, { q: 1, r: -1, type: 'biofarming' }],
    points: 4, illustration: 'nexus', district: 4,
    description: 'The field knows. The sun gives. Together they power everything.',
  },
  {
    id: 'card_41', name: 'AI Commons',
    pattern: [{ q: 0, r: 0, type: 'technology' }, { q: 0, r: 1, type: 'technology' }, { q: 1, r: -1, type: 'energy' }, { q: -1, r: 1, type: 'community' }],
    points: 4, illustration: 'lab', district: 7,
    description: 'Technology designed with soul · the rarest substance on Earth.',
  },
  {
    id: 'card_42', name: 'Soul Academy',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 1, r: 0, type: 'community' }, { q: 1, r: -1, type: 'biofarming' }, { q: 0, r: 1, type: 'technology' }],
    points: 4, illustration: 'academy', district: 3,
    description: 'Education that awakens instead of programs. The rarest school.',
  },
  {
    id: 'card_43', name: 'Tesla Coil Station',
    pattern: [{ q: 0, r: 0, type: 'energy' }, { q: 1, r: -1, type: 'energy' }, { q: 0, r: 1, type: 'community' }, { q: -1, r: 1, type: 'community' }],
    points: 4, illustration: 'grid', district: 4,
    description: 'Power distributed with love cannot be corrupted. The grid is the covenant.',
  },
  {
    id: 'card_44', name: 'Reiki Healing School',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 0, r: 1, type: 'community' }, { q: 1, r: 0, type: 'biofarming' }, { q: 1, r: -1, type: 'technology' }],
    points: 4, illustration: 'center', district: 2,
    description: 'The body knows how to heal. We build the conditions and step aside.',
  },
  {
    id: 'card_45', name: 'Heritage Orchard',
    pattern: [{ q: 0, r: 0, type: 'biofarming' }, { q: 0, r: 1, type: 'community' }, { q: 1, r: 0, type: 'biofarming' }, { q: -1, r: 1, type: 'community' }],
    points: 4, illustration: 'garden', district: 8,
    description: 'We plant what our grandparents dreamed. We harvest what our children will know.',
  },
  {
    id: 'card_46', name: 'Bioelectric Lab',
    pattern: [{ q: 0, r: 0, type: 'technology' }, { q: 1, r: 0, type: 'energy' }, { q: 1, r: 1, type: 'technology' }, { q: 0, r: 1, type: 'energy' }],
    points: 4, illustration: 'hub', district: 2,
    description: 'Everything vibrates. The question is always: at what frequency are we building?',
  },
  {
    id: 'card_47', name: 'Peacemaking Circle',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 1, r: 0, type: 'biofarming' }, { q: 0, r: 1, type: 'community' }, { q: -1, r: 1, type: 'biofarming' }],
    points: 4, illustration: 'embassy', district: 9,
    description: 'No one negotiates from behind a wall. The circle has no head of the table.',
  },
  {
    id: 'card_48', name: 'Consensus Hall',
    pattern: [{ q: 0, r: 0, type: 'technology' }, { q: 1, r: -1, type: 'community' }, { q: 0, r: 1, type: 'biofarming' }, { q: 1, r: 0, type: 'energy' }],
    points: 4, illustration: 'node', district: 1,
    description: 'Where all four forces agree: that is the center of NeoTopia.',
  },

  // 5-ELEMENT CARDS (8 cards, 5pts)
  {
    id: 'card_49', name: 'NeoTopia Heart',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 1, r: 0, type: 'energy' }, { q: -1, r: 1, type: 'biofarming' },
              { q: 0, r: 1, type: 'technology' }, { q: 1, r: -1, type: 'community' }],
    points: 5, illustration: 'heart', district: 1,
    description: 'The full civilization compressed into five connected hexes. This is what we are building.',
  },
  {
    id: 'card_50', name: 'School of Unseen Arts',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 1, r: 0, type: 'community' }, { q: -1, r: 1, type: 'community' },
              { q: 0, r: 1, type: 'energy' }, { q: 1, r: -1, type: 'technology' }],
    points: 5, illustration: 'temple', district: 1,
    description: 'What cannot be measured still has to be taught. The quietest building in the district.',
  },
  {
    id: 'card_51', name: 'Infinite Garden',
    pattern: [{ q: 0, r: 0, type: 'biofarming' }, { q: 1, r: 0, type: 'biofarming' }, { q: 0, r: 1, type: 'biofarming' },
              { q: 1, r: -1, type: 'biofarming' }, { q: -1, r: 1, type: 'community' }],
    points: 5, illustration: 'garden', district: 5,
    description: 'Five growing things surrounding one witness. The food forest and its guardian.',
  },
  {
    id: 'card_52', name: 'Solar Hydrogen Array',
    pattern: [{ q: 0, r: 0, type: 'energy' }, { q: 1, r: 0, type: 'energy' }, { q: -1, r: 1, type: 'energy' },
              { q: 0, r: 1, type: 'technology' }, { q: 1, r: -1, type: 'energy' }],
    points: 5, illustration: 'array', district: 4,
    description: 'Four aligned energy sources and one intelligence to guide them. Free energy becomes real.',
  },
  {
    id: 'card_53', name: 'World Assembly Hall',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 1, r: 0, type: 'technology' }, { q: 0, r: 1, type: 'community' },
              { q: -1, r: 1, type: 'energy' }, { q: 1, r: -1, type: 'biofarming' }],
    points: 5, illustration: 'hall', district: 9,
    description: 'All four elements gathered in service of the ninth district. Every people, one room, one table.',
  },
  {
    id: 'card_54', name: 'Stellar Observatory',
    pattern: [{ q: 0, r: 0, type: 'technology' }, { q: 1, r: 0, type: 'energy' }, { q: 0, r: 1, type: 'technology' },
              { q: -1, r: 1, type: 'community' }, { q: 1, r: -1, type: 'energy' }],
    points: 5, illustration: 'observatory', district: 7,
    description: 'A deep-field array reading the sky across every frequency · the civilization listening for what comes next.',
  },
  {
    id: 'card_55', name: 'Grand Forum',
    pattern: [{ q: 0, r: 0, type: 'technology' }, { q: 1, r: 0, type: 'community' }, { q: 0, r: 1, type: 'biofarming' },
              { q: -1, r: 1, type: 'energy' }, { q: 0, r: -1, type: 'community' }],
    points: 5, illustration: 'core', district: 6,
    description: 'Where the whole district gathers to decide. Five elements, one room, one voice at a time.',
  },
  {
    id: 'card_56', name: 'Wardenclyffe Tower',
    pattern: [{ q: 0, r: 0, type: 'energy' }, { q: 1, r: 0, type: 'biofarming' }, { q: 0, r: 1, type: 'technology' },
              { q: 1, r: -1, type: 'community' }, { q: -1, r: 1, type: 'energy' }],
    points: 5, illustration: 'horizon', district: 1,
    description: 'Power with no wire and no meter. Drawn in 1901, and the district finally built it.',
  },
]

// Fresh, shuffleable copy of the deck.
export const DECK = [...PROJECT_CARDS]

// 56 is the physical game's count and the deck drives game length alongside the production tile
// stack, so a wrong number here is not a warning, it is a different game. This used to console.error
// and continue · which in production means nobody is told at all, the exact silent-failure shape this
// project keeps finding (games_played sat at 0 for six weeks because no one ever read it back). It is
// a compile-time constant: it can only trip if someone edits this file, and then it should stop them.
if (PROJECT_CARDS.length !== 56) {
  throw new Error(`NeoTopia deck must be exactly 56 cards · found ${PROJECT_CARDS.length}`)
}
