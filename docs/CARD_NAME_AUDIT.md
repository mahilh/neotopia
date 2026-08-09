# CARD NAME AUDIT · all 56

T1 · S33 · August 9 2026. **Audit and handoff, not an edit.** The deck lives in `src/lib/projectCards.js`,
which is T2's lane, and T2 landed `projectCards.test.js` in this same session to pin exactly what a
rename must not disturb (ids, count, point distribution, patterns). Their header says the vocabulary is
"Mahil's call and T1's audit". This is that audit.

Nothing here has been renamed. **Mahil approves, T2 applies.**

## The test applied

> Can somebody who has never heard of this game read the name and picture a building, and half-guess
> what it does?

Not "is it beautiful" and not "is it on-brand". A name can be both and still teach nothing. `Hempcrete
District` passes the test at a glance. `Naacal Seed Archive` cannot be parsed by anybody who has not
read Theosophical literature, and it is a **seed bank** · one of the most legible buildings a 2055 city
could have, hidden behind a word almost nobody knows.

## Counts

| Bucket | Count | Verdict |
|---|---|---|
| **A · already plain and evocative** | **24** | Leave alone |
| **B · esoteric jargon a new player cannot parse** | **20** | Rename |
| **C · borderline** | **12** | Mahil's call |

The count stays 56 in every case. This is renaming, not reducing · the deck length drives game length
alongside the production tile stack.

## A · leave alone (24)

These already name a building and carry the solarpunk-2055 register without help.

`card_01` Fibonacci Solar Terrace · `card_04` Council Ring · `card_13` Sacred Geometry Park ·
`card_14` Living Earth Collective · `card_16` Healing Sanctuary · `card_18` Meditation Hall ·
`card_20` Food Forest · `card_21` Solarpunk Atrium · `card_23` Free Energy Lab · `card_31` Solar Temple ·
`card_33` Holographic Research Center · `card_34` Regeneration Field · `card_35` Sacred Water Tower ·
`card_36` Hempcrete District · `card_38` Pyramid Research Center · `card_44` Healing Arts Center ·
`card_45` Ancestral Memory Garden · `card_47` Earth Embassy · `card_49` NeoTopia Heart ·
`card_51` Infinite Garden · `card_52` Solar Hydrogen Array · `card_54` Stellar Observatory ·
`card_55` Living City Core · `card_56` 2055 Horizon

`Food Forest`, `Hempcrete District` and `Solar Hydrogen Array` are the strongest names in the deck:
each is a real thing a city is building **today**, which is the whole premise of the game.

## B · rename (20)

Two failure modes, and they need different fixes.

### B1 · a proper noun from an esoteric tradition (11)

The name's load-bearing word is a term from Theosophy, Atlantis/Mu literature or Egyptian cosmology.
A player cannot decode it, and there is no context in the game that teaches it.

| id | current | why it fails | proposal |
|---|---|---|---|
| `card_05` | Orichalcum Arc Node | Orichalcum · Atlantean alloy | **Copper Arc Substation** |
| `card_06` | Naacal Seed Archive | Naacal · tablets of Mu | **Community Seed Bank** |
| `card_08` | Fohat Activation Node | Fohat · Theosophical cosmic force | **Shared Battery Hall** |
| `card_09` | Akashic Grove | Akashic · Theosophical records | **Data Grove** |
| `card_15` | Fohat Transmission Tower | as above | **Wireless Power Tower** |
| `card_17` | Orichalcum Energy Spire | as above | **Solar Updraft Tower** |
| `card_27` | Cymatics Healing Chamber | Cymatics · fringe acoustics | **Sound Therapy Hall** |
| `card_28` | Akashic Living Archive | as above | **City Memory Archive** |
| `card_30` | Naacal Seed Library | as above | **Seed Library** |
| `card_39` | Ennead Council Chamber | Ennead · the Egyptian nine | **Council of Nine** |
| `card_43` | Fohat Harmonic Grid | as above | **Harmonic Microgrid** |

`Seed Library` and `Community Seed Bank` are real civic institutions. `Microgrid` and `Solar Updraft
Tower` are real energy infrastructure. None of them cost the register anything · they gain it, because
solarpunk is a genre about buildings that actually work.

`Council of Nine` deliberately keeps the Ennead's **nine**, so the numerology survives the rename in a
form a player can see.

### B2 · names no building at all (9)

Abstractions and pseudo-scientific compounds. Even a reader who parses every word cannot picture a
place, which is the specific problem: these are supposed to be districts.

| id | current | proposal |
|---|---|---|
| `card_02` | Mycelial Memory Array | **Mycelium Data Farm** |
| `card_07` | Crystal Healing Waters | **Mineral Springs Baths** |
| `card_11` | Open Source Consciousness | **Open Source Workshop** |
| `card_12` | Aeolian Frequency Array | **Rooftop Wind Array** |
| `card_19` | Stellar Coherence Station | **Orbital Uplink Station** |
| `card_22` | Sound Frequency Gateway | **Acoustic Pavilion** |
| `card_26` | Cosmic Cartography Nexus | **Star Chart Institute** |
| `card_46` | Biofield Frequency Laboratory | **Bioelectric Research Lab** |
| `card_48` | Covenant Node | **Charter Hall** |

`Node`, `Nexus`, `Array` and `Gateway` appear nine times across the deck between them and none of them
is a building. That repetition is its own problem: it makes distinct cards feel interchangeable.

## C · borderline · Mahil's call (12)

Each has one esoteric or abstract word attached to a concrete one. They are readable, and they carry
more of the civilization's voice than bucket A does. **My recommendation is to keep all twelve** · a
deck renamed to nothing but literal infrastructure would read as a municipal planning document, and
these are what stop that happening. Listed so the decision is yours rather than mine by omission.

`card_03` Resonance Crossing · `card_10` Helios Source Spring · `card_24` Crystal Academy ·
`card_25` Mycelium Intelligence Dome · `card_29` Consciousness Hub · `card_32` Open Contact Embassy ·
`card_37` Consciousness Broadcast Tower · `card_40` Bio-Energy Nexus · `card_41` Conscious Tech Lab ·
`card_42` Soul Academy · `card_50` Source Temple · `card_53` Cosmic Council Hall

## Notes for whoever applies it

- **Ids never change.** `scoredCardIds`, the `game_end` audit payload, every saved fixture and the art
  path `/art/cards/<id>.png` (CardFrame.jsx:121) all key on the id. T2's guard pins this.
- **`illustration` never changes.** The Diverse City rule compares `region.lastBuiltIllustration` to
  `card.illustration`; editing that field while editing a name silently changes what may be built where.
- Names are rendered in `CardFrame` at hand size. The longest proposal here is `Bioelectric Research
  Lab` (25 chars) against the current longest `Consciousness Broadcast Tower` (29), so nothing gets
  wider · worth a glance at the card face anyway before it lands.
- 56 stays 56.
