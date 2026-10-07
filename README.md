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

- You die if you hit the wall, cross your own trail, or someone crosses your trail.
- Head-on collision: the player standing on their own land survives; otherwise both die.
- If all of a player's land is captured, they're eliminated.
- Bots respawn a few seconds after dying.

## Files

- `index.html` — page layout, menus and HUD
- `style.css` — styling
- `game.js` — game logic, bot AI and rendering (tweak constants at the top: `GRID`, `SPEED`, `BOT_COUNT`, ...)
