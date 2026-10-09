# The Eze'Rhi'El

An idle / incremental game built on the DRPG's Eze'Rhi'El: the title Judge Damien's corrupted Court of Skull grants to the champion of its tournament, along with a sliver of the Nightmare Child's power through the crack in its cage.

You start as a cold ember in the dark. You end by opening the Door.

## Play

Open `index.html` in a browser. There is no build step and nothing to install. The game saves itself to the browser every 30 seconds. **Settings → Carry your fire elsewhere** gives you save text you can copy and paste between browsers.

**Buying:** every upgrade has an icon.

- **Click** the icon to buy one.
- **Right-click** it (or **long-press** on a phone) to buy as many as you can afford.
- The **Buy 1** and **Max** buttons beside each icon do the same.

## How it unfolds

The game starts as a clicker and adds a new system with every tier of ascension. Each ascension is a reset that pays a new resource and needs a different kind of resource to reach.

| Tier | Ascension | Requires | Pays | Opens up |
|---|---|---|---|---|
| — | *The ember* | — | Embers | Stoking, 12 Kindlings, Rites, the Child's whispers, Omens, the Power Hierarchy |
| I | **Regenerate** | 40 M embers in one life | Ash | The Ashen Tree, the Crack (a ghost army with jobs), the Tournament of Skull |
| II | **Claim the Title** | 10 Skull Sigils (champions beaten in the Tournament) | Slivers of the Child | Gifts, Shades (automation), the Grimoire (spells), the Time War (Artron production chain) |
| III | **Burn a Timeline** | 1 quadrillion Artron | Paradox | Burnt Timelines (9 challenges named after the Time War Chronicles), the Siege of Heaven's Gate |
| IV | **Cut the Cage** | 100 Grace (taken from broken choirs of angels) | Nightmare | The hunt for the Lumen Cascade |
| V | **Open the Door** | All 7 lights of the Lumen Cascade extinguished | A Child's Cataclysm | The ending, then a new cycle with ×1,000 embers per cataclysm |

Each tier pays only for new progress: what your record is worth now, minus what that tier has already paid you. Resetting early gives nothing. Shades, Omens, your rank in the Power Hierarchy (XV Mankind → I Death) and completed timelines are never lost.

Inspirations: Cookie Clicker (the Eye, buildings, golden whispers), A Dark Room (the slowly revealed interface and the lowercase log), Trimps (the ghost army and the Tournament), Revolution Idle and Antimatter Dimensions (stacked prestige layers, the Time War's production chain, challenges), and The Perfect Tower 2 (configurable automation).

## Lore

Flavour comes only from the DRPG material: Act 1 and Act 2, *Journey to the Cataclysm*, *The Lumen Cascade*, the *Power Hierarchy*, *Armies*, the Time War Chronicles episode titles, Bluefire and the Red Faction. Nothing comes from the D&D / Immortalia version.

## Development

```sh
node tools/test.js        # engine tests, including a scripted player who reaches the Door
node tools/sim.js 24      # balance simulator: a greedy bot plays N hours and prints milestones
node tools/build.js       # bundles everything into dist/ezerhiel.html (one self-contained page)
```

Open the game with `#dev` on the end of the URL to get time-skip buttons in Settings.

| File | Contents |
|---|---|
| `js/data.js` | All content: Kindlings, upgrades, tiers, challenges, omens, ranks, story lines |
| `js/engine.js` | Game rules, with no DOM access, so it runs in Node too |
| `js/ui.js`, `js/main.js` | Interface, game loop, saving, offline progress |
| `js/icons.js` | The hand-drawn SVG icon set |
| `js/fx.js` | Falling ash and rising embers |
| `css/style.css` | Styles |
