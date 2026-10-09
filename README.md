# second-app — Paper Territory

A browser game inspired by paper.io. Leave your territory to draw a trail,
loop back to your land to claim everything you enclosed, and cut other
players' trails to eliminate them.

## Play

No build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Controls

- **Phone/tablet:** put your thumb down anywhere and drag; your avatar heads the way you drag (floating joystick)
- **Desktop:** your avatar heads toward the mouse cursor, or steer with arrow keys / WASD (hold two for diagonals)

## Rules

- The arena is round. Glancing off the border slides you along it; driving straight into it kills you.
- You die if you cross your own trail or someone crosses your trail.
- Head-on collision: the player standing on their own land survives; otherwise both die.
- If all of a player's land is captured, they're eliminated.
- A player's land must stay in one piece. If someone cuts it in two, the smaller piece goes back to neutral.
- Bots respawn a few seconds after dying, as long as there's free space.
- Own 100% of the arena to win.

## Hard mode

When you own 60% of the arena, hard mode switches on for the rest of that game:

- Ordinary bots that die stay dead.
- Three **ultra-bots** join. They share one look (dark with stripes and a red outline) and play as a team: their land is scored together as one "Ultra-bots" entry, they can cross each other's trails, never crash into or hunt each other, and never take each other's land (a teammate's land counts as a wall when they enclose an area).
- Ultra-bots spawn in different places, move 15% faster than everyone else, and keep respawning.
- The goal is unchanged: own 100% of the arena.
- To skip straight to it, tap **Play hard mode** on the start screen. **Play again** repeats whichever mode you last played; **Play** always starts a normal game.

## Skins

Pick a colour and a pattern (solid, stripes, dots, checks, waves) on the start screen. Your choice and your best score are remembered on that device.

## Files

- `index.html` — page layout, menus and HUD
- `style.css` — styling
- `game.js` — game logic, bot AI and rendering (tweak constants at the top: `GRID`, `SPEED`, `BOT_COUNT`, ...)
