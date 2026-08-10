# CARD RENAME · premise-check done, waiting on the list
**T2 S40 · the 26-name payload for cards 31-56 had not landed in comms at session close**

Everything checkable without the list is checked below, so applying it is a mechanical pass rather
than a research pass. **Three findings change how the list should be read**, and all three are
decisions for Mahil rather than things I should quietly fix.

---

## 1 · `pattern[0].type` is the ANCHOR HEX, not the card's element

This is the one that matters, because the four corrections in the brief were derived from it.

`pattern[0]` is simply the tile at `(q:0, r:0)` · the pattern's origin. It is not a declared element
field and nothing in the engine treats it as the card's identity. **It disagrees with, or ties, the
card's actual majority element on 24 of 56 cards.**

All four corrections in the brief are right *about the anchor*. Two of them are shakier about the card:

| card | brief's key | anchor | actual composition | verdict |
|---|---|---|---|---|
| `card_35` Sacred Water Tower → **Community Water Tower** | community | community | community:2 biofarming:1 energy:1 | ✅ anchor **and** majority agree |
| `card_44` Healing Arts Center → **Reiki Healing School** | (community) | community | community:2 biofarming:1 technology:1 | ✅ agree |
| `card_38` Pyramid Research Center → **Pyramid Power Plant** | energy "confirmed" | energy | **energy:2 technology:2** | ⚠️ **a 2-2 tie.** Energy and technology are equally defensible. "Research Center" was not wrong; "Power Plant" is not more right. A coin flip either way. |
| `card_47` Earth Embassy → **Peacemaking Circle** | (community) | community | **community:2 biofarming:2** | ⚠️ tie, but community reads fine |
| `card_48` Charter Hall → **Open Data Hall** | "technology, not community" | technology | **technology:1 community:1 biofarming:1 energy:1** | ⚠️ **a perfect four-way tie**, and the card's own description is *"Where all four forces agree: that is the center of NeoTopia."* This card is deliberately all four. Naming it for technology because the origin hex happens to be technology contradicts its own text. |
| `card_55` Living City Core → **Crystal Core** | "technology, not biofarming" | technology | technology:1 **community:2** biofarming:1 energy:1 | 🔴 **the correction moved it off the wrong element onto another wrong element.** Biofarming was indeed wrong. But the majority element is **community**, not technology. |

**Recommendation:** the rename list is Mahil's call and I have not changed a single name. But if the
element key is meant to express what the card *is*, it should be computed from the whole pattern, not
read off `pattern[0]`. Reproduce the table above with the snippet in §4.

## 2 · Two of the six known renames leave the description echoing the RETIRED name

The brief's warning · *"five descriptions named terms being removed last time"* · is already true in
the sample of six, before the other 20 arrive:

- **`card_47` Earth Embassy → Peacemaking Circle.** Description: *"Every piece of living land is
  sovereign. We are its **ambassadors**."* Also `illustration: 'embassy'`.
- **`card_55` Living City Core → Crystal Core.** Description: *"Sacred solarpunk futurism made
  concrete. The city as a **living mandala**."* · which is a restatement of the name being removed.

The other four are clean: `card_35`, `card_38`, `card_44`, `card_48` descriptions name nothing that
the rename retires.

`illustration` keys are a separate axis and mostly survive a rename, but `card_47`'s `'embassy'` is
now the only one that names its old title directly. Low stakes · `illustration` drives
`region.lastBuiltIllustration` (Rule 12), not the card art.

## 3 · card_29 · renaming it is FREE, and it is not alone

**The art question, answered: renaming orphans nothing.** `CardFrame.jsx:121` resolves art as
``/art/cards/${card.id}.png`` · keyed on the **id**, never the name. `card_29`'s id does not change,
so any future `card_29.png` still binds. And separately there is no art to orphan: `public/art/cards/`
holds `card_01.png` through `card_20.png`, 20 files, so 29 has none either way.

**But the brief flags one card and there are three.** The "conscious" family in *names*:

| card | name | in the 31-56 list? |
|---|---|---|
| `card_29` | Consciousness Hub | ❌ **no · 1-30, flagged by the brief** |
| `card_37` | Consciousness Broadcast Tower | ✅ presumably covered |
| `card_41` | Conscious Tech Lab | ✅ presumably covered |

And in *descriptions*, which no name list will touch:

| card | description | in rename scope? |
|---|---|---|
| `card_15` Wireless Power Tower | "**Consciousness** rises from earth to sky…" | ❌ 1-30 |
| `card_25` Mycelium Intelligence Dome | "The first **conscious** building material…" | ❌ 1-30 |
| `card_34` Regeneration Field | "Four seasons of **conscious** farming…" | ✅ 31-56 |
| `card_50` Source Temple | "…the work of expanding **consciousness** begins." | ✅ 31-56 |

So even after the 26-name pass lands, the deck ships with the word gone from every *name* in 31-56 and
still present in **four descriptions and one 1-30 name** (`card_29`). Two of those descriptions are
inside the rename scope and two are not.

> I first attributed these to `card_24`, `card_30` and `card_51` by reading line numbers against the
> nearest heading I remembered. Three of the four were wrong. The ids above are computed by walking the
> file and tracking the enclosing card · Rule 81, in a costume where the wrong answer is cheap to check
> and would have sent someone editing three innocent cards.

**Not touched:** "Sacred" appears to be *staying* · region 0 is literally **Sacred City**, and
`sacredMilestone` is a live symbol in CLAUDE.md. Only `card_35` sheds it, and only incidentally. I have
assumed "sacred" is not on the removal list; say if it is and the sweep is four names plus five
descriptions. "Node" and "Gateway" are already gone from every name (they survive only as internal
`illustration` keys, which are not player-visible).

## 4 · Reproduce the composition table

```bash
node -e '
const s=require("fs").readFileSync("src/lib/projectCards.js","utf8");
const re=/id: .(card_\d+)., name: .([^.]+)?.,\s*\n\s*pattern: \[([\s\S]*?)\],\s*\n/g;let m;
while((m=re.exec(s))){
  const t=[...m[3].matchAll(/type: .(\w+)./g)].map(x=>x[1]);
  const c={};t.forEach(x=>c[x]=(c[x]||0)+1);
  const max=Math.max(...Object.values(c));
  const top=Object.keys(c).filter(k=>c[k]===max);
  if(!(top.length===1&&top[0]===t[0]))
    console.log(m[1],m[2],"anchor="+t[0],"majority="+top.join("/"));
}'
```

## 5 · When the list lands

1. Apply the 26 names to `src/lib/projectCards.js` (T1's audit `28c077a` is the precedent · bucket B
   was 20 renames and 56 stayed 56).
2. **Re-read every renamed card's `description`** against §2's failure mode · that is the step that
   was missed last time, and it has already caught two of six here.
3. Decide `card_29` (§3) and whether the description sweep is in scope.
4. Re-run `npx vitest run --no-file-parallelism`. Names are asserted in the deck tests; a rename that
   breaks 56-stays-56 or a duplicate id will go red immediately.
