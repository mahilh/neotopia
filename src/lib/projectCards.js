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
    id: 'card_02', name: 'Mycelial Memory Array',
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
    id: 'card_05', name: 'Orichalcum Arc Node',
    pattern: [{ q: 0, r: 0, type: 'energy' }, { q: 0, r: 1, type: 'technology' }],
    points: 2, illustration: 'node', district: 7,
    description: 'Atlantean energy principles, reborn in clean plasma and conscious design.',
  },
  {
    id: 'card_06', name: 'Naacal Seed Archive',
    pattern: [{ q: 0, r: 0, type: 'biofarming' }, { q: 1, r: -1, type: 'community' }],
    points: 2, illustration: 'vault', district: 5,
    description: 'Before cities: seeds. The Naacal stored what Mu knew. We continue.',
  },
  {
    id: 'card_07', name: 'Crystal Healing Waters',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 1, r: 0, type: 'biofarming' }],
    points: 2, illustration: 'pool', district: 2,
    description: 'Water charged with intention is the oldest medicine still working.',
  },
  {
    id: 'card_08', name: 'Fohat Activation Node',
    pattern: [{ q: 0, r: 0, type: 'energy' }, { q: 0, r: 1, type: 'community' }],
    points: 2, illustration: 'terminal', district: 4,
    description: 'The cosmic electricity Blavatsky named: now flowing through conscious circuitry.',
  },
  {
    id: 'card_09', name: 'Akashic Grove',
    pattern: [{ q: 0, r: 0, type: 'technology' }, { q: 0, r: 1, type: 'biofarming' }],
    points: 2, illustration: 'grove', district: 7,
    description: 'A living computer: the forest stores what the Akashic field remembers.',
  },
  {
    id: 'card_10', name: 'Helios Source Spring',
    pattern: [{ q: 0, r: 0, type: 'energy' }, { q: 1, r: -1, type: 'biofarming' }],
    points: 2, illustration: 'spring', district: 5,
    description: 'Sun feeds water feeds earth: an unbroken sacred loop, three elements as one.',
  },
  {
    id: 'card_11', name: 'Open Source Consciousness',
    pattern: [{ q: 0, r: 0, type: 'technology' }, { q: 1, r: 0, type: 'community' }],
    points: 2, illustration: 'commons', district: 8,
    description: 'Share the code. Share the light. No knowledge is private in NeoTopia.',
  },
  {
    id: 'card_12', name: 'Aeolian Frequency Array',
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
    id: 'card_15', name: 'Fohat Transmission Tower',
    pattern: [{ q: 0, r: 0, type: 'technology' }, { q: 0, r: 1, type: 'technology' }, { q: 0, r: 2, type: 'energy' }],
    points: 3, illustration: 'tower', district: 7,
    description: 'Consciousness rises from earth to sky, carried on frequencies we are learning to read.',
  },
  {
    id: 'card_16', name: 'Healing Sanctuary',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 1, r: 0, type: 'biofarming' }, { q: 1, r: -1, type: 'community' }],
    points: 3, illustration: 'sanctuary', district: 2,
    description: 'The body heals fastest in spaces designed for healing.',
  },
  {
    id: 'card_17', name: 'Orichalcum Energy Spire',
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
    id: 'card_19', name: 'Stellar Coherence Station',
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
    id: 'card_22', name: 'Sound Frequency Gateway',
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
    description: 'The first conscious building material. Grown, not manufactured. Alive, not inert.',
  },
  {
    id: 'card_26', name: 'Cosmic Cartography Nexus',
    pattern: [{ q: 0, r: 0, type: 'technology' }, { q: 1, r: 0, type: 'energy' }, { q: -1, r: 1, type: 'community' }],
    points: 3, illustration: 'starmap', district: 9,
    description: 'To know where we are in the galaxy is to know what we are responsible for.',
  },
  {
    id: 'card_27', name: 'Cymatics Healing Chamber',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 0, r: 1, type: 'energy' }, { q: 1, r: -1, type: 'community' }],
    points: 3, illustration: 'chamber', district: 2,
    description: 'Frequency made visible becomes sacred geometry. The body recognizes its origin.',
  },
  {
    id: 'card_28', name: 'Akashic Living Archive',
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
    id: 'card_30', name: 'Naacal Seed Library',
    pattern: [{ q: 0, r: 0, type: 'biofarming' }, { q: -1, r: 1, type: 'biofarming' }, { q: 1, r: 0, type: 'community' }],
    points: 3, illustration: 'library', district: 5,
    description: 'A seed is a compressed universe. We keep universes here, organized by memory.',
  },

  // 4-ELEMENT CARDS (18 cards, 4pts)
  {
    id: 'card_31', name: 'Solar Temple',
    pattern: [{ q: 0, r: 0, type: 'energy' }, { q: 1, r: 0, type: 'community' }, { q: 1, r: -1, type: 'energy' }, { q: 0, r: 1, type: 'community' }],
    points: 4, illustration: 'temple', district: 1,
    description: 'The oldest technology is the sacred building. Stone aligned with sun.',
  },
  {
    id: 'card_32', name: 'Open Contact Embassy',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 1, r: 0, type: 'technology' }, { q: 0, r: 1, type: 'community' }, { q: 1, r: -1, type: 'technology' }],
    points: 4, illustration: 'embassy', district: 9,
    description: 'A civilization ready for contact with the unknown is a civilization ready for itself.',
  },
  {
    id: 'card_33', name: 'Holographic Research Center',
    pattern: [{ q: 0, r: 0, type: 'technology' }, { q: 1, r: 0, type: 'technology' }, { q: 0, r: 1, type: 'community' }, { q: 1, r: -1, type: 'energy' }],
    points: 4, illustration: 'campus', district: 7,
    description: "Bohm's implicate order made visible: the universe unfolds from this room.",
  },
  {
    id: 'card_34', name: 'Regeneration Field',
    pattern: [{ q: 0, r: 0, type: 'biofarming' }, { q: 1, r: 0, type: 'biofarming' }, { q: 0, r: 1, type: 'biofarming' }, { q: 1, r: -1, type: 'energy' }],
    points: 4, illustration: 'field', district: 5,
    description: 'Four seasons of conscious farming restore what centuries of extraction took.',
  },
  {
    id: 'card_35', name: 'Sacred Water Tower',
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
    id: 'card_37', name: 'Consciousness Broadcast Tower',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 1, r: 0, type: 'technology' }, { q: 2, r: 0, type: 'community' }, { q: 1, r: 1, type: 'community' }],
    points: 4, illustration: 'studio', district: 8,
    description: 'What you transmit becomes the frequency of the district. Choose carefully.',
  },
  {
    id: 'card_38', name: 'Pyramid Research Center',
    pattern: [{ q: 0, r: 0, type: 'energy' }, { q: 1, r: 0, type: 'technology' }, { q: 0, r: 1, type: 'technology' }, { q: 1, r: -1, type: 'energy' }],
    points: 4, illustration: 'pyramid', district: 4,
    description: 'Ancient structure. Modern understanding. My grandfather stood here first.',
  },
  {
    id: 'card_39', name: 'Ennead Council Chamber',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 1, r: 0, type: 'community' }, { q: 0, r: 1, type: 'technology' }, { q: -1, r: 1, type: 'community' }],
    points: 4, illustration: 'chamber', district: 1,
    description: 'Nine seats. Nine principles. The Egyptian Ennead remembered in modern form.',
  },
  {
    id: 'card_40', name: 'Bio-Energy Nexus',
    pattern: [{ q: 0, r: 0, type: 'biofarming' }, { q: 1, r: 0, type: 'energy' }, { q: 0, r: 1, type: 'energy' }, { q: 1, r: -1, type: 'biofarming' }],
    points: 4, illustration: 'nexus', district: 4,
    description: 'The field knows. The sun gives. Together they power everything.',
  },
  {
    id: 'card_41', name: 'Conscious Tech Lab',
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
    id: 'card_43', name: 'Fohat Harmonic Grid',
    pattern: [{ q: 0, r: 0, type: 'energy' }, { q: 1, r: -1, type: 'energy' }, { q: 0, r: 1, type: 'community' }, { q: -1, r: 1, type: 'community' }],
    points: 4, illustration: 'grid', district: 4,
    description: 'Power distributed with love cannot be corrupted. The grid is the covenant.',
  },
  {
    id: 'card_44', name: 'Healing Arts Center',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 0, r: 1, type: 'community' }, { q: 1, r: 0, type: 'biofarming' }, { q: 1, r: -1, type: 'technology' }],
    points: 4, illustration: 'center', district: 2,
    description: 'The body knows how to heal. We build the conditions and step aside.',
  },
  {
    id: 'card_45', name: 'Ancestral Memory Garden',
    pattern: [{ q: 0, r: 0, type: 'biofarming' }, { q: 0, r: 1, type: 'community' }, { q: 1, r: 0, type: 'biofarming' }, { q: -1, r: 1, type: 'community' }],
    points: 4, illustration: 'garden', district: 8,
    description: 'We plant what our grandparents dreamed. We harvest what our children will know.',
  },
  {
    id: 'card_46', name: 'Biofield Frequency Laboratory',
    pattern: [{ q: 0, r: 0, type: 'technology' }, { q: 1, r: 0, type: 'energy' }, { q: 1, r: 1, type: 'technology' }, { q: 0, r: 1, type: 'energy' }],
    points: 4, illustration: 'hub', district: 2,
    description: 'Everything vibrates. The question is always: at what frequency are we building?',
  },
  {
    id: 'card_47', name: 'Earth Embassy',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 1, r: 0, type: 'biofarming' }, { q: 0, r: 1, type: 'community' }, { q: -1, r: 1, type: 'biofarming' }],
    points: 4, illustration: 'embassy', district: 9,
    description: 'Every piece of living land is sovereign. We are its ambassadors.',
  },
  {
    id: 'card_48', name: 'Covenant Node',
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
    id: 'card_50', name: 'Source Temple',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 1, r: 0, type: 'community' }, { q: -1, r: 1, type: 'community' },
              { q: 0, r: 1, type: 'energy' }, { q: 1, r: -1, type: 'technology' }],
    points: 5, illustration: 'temple', district: 1,
    description: 'The inner temple of NeoTopia. Where the work of expanding consciousness begins.',
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
    id: 'card_53', name: 'Cosmic Council Hall',
    pattern: [{ q: 0, r: 0, type: 'community' }, { q: 1, r: 0, type: 'technology' }, { q: 0, r: 1, type: 'community' },
              { q: -1, r: 1, type: 'energy' }, { q: 1, r: -1, type: 'biofarming' }],
    points: 5, illustration: 'hall', district: 9,
    description: 'All four elements gathered in service of the ninth district: open contact with the unknown.',
  },
  {
    id: 'card_54', name: 'Stellar Observatory',
    pattern: [{ q: 0, r: 0, type: 'technology' }, { q: 1, r: 0, type: 'energy' }, { q: 0, r: 1, type: 'technology' },
              { q: -1, r: 1, type: 'community' }, { q: 1, r: -1, type: 'energy' }],
    points: 5, illustration: 'observatory', district: 7,
    description: 'A deep-field array reading the sky across every frequency · the civilization listening for what comes next.',
  },
  {
    id: 'card_55', name: 'Living City Core',
    pattern: [{ q: 0, r: 0, type: 'technology' }, { q: 1, r: 0, type: 'community' }, { q: 0, r: 1, type: 'biofarming' },
              { q: -1, r: 1, type: 'energy' }, { q: 0, r: -1, type: 'community' }],
    points: 5, illustration: 'core', district: 6,
    description: 'Sacred solarpunk futurism made concrete. The city as a living mandala.',
  },
  {
    id: 'card_56', name: '2055 Horizon',
    pattern: [{ q: 0, r: 0, type: 'energy' }, { q: 1, r: 0, type: 'biofarming' }, { q: 0, r: 1, type: 'technology' },
              { q: 1, r: -1, type: 'community' }, { q: -1, r: 1, type: 'energy' }],
    points: 5, illustration: 'horizon', district: 1,
    description: 'The year this civilization exists in physical reality. Every card played brings it closer.',
  },
]

// Fresh, shuffleable copy of the deck.
export const DECK = [...PROJECT_CARDS]

if (PROJECT_CARDS.length !== 56) {
  console.error('NeoTopia card count error:', PROJECT_CARDS.length, '(expected 56)')
}
