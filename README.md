# second-app — Soundboard

A static soundboard: a grid of pads that play sound effects, driven entirely by
`sounds.json`. No build step, no dependencies, no framework.

## Run it

Browsers block `fetch` on `file://` URLs, so serve the folder rather than
double-clicking `index.html`:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static server works (`npx serve`, `php -S localhost:8000`, GitHub Pages, Netlify).

## Add your sounds

1. Put the audio files in `sounds/` (MP3 is the safest format).
2. List them in `sounds.json`.

```json
{
  "title": "My Soundboard",
  "sounds": [
    { "id": "airhorn", "label": "Air Horn", "category": "Classic", "emoji": "📢" }
  ]
}
```

| Field      | Required | Default                | Notes                                        |
| ---------- | -------- | ---------------------- | -------------------------------------------- |
| `id`       | yes      | —                      | Slug; also the default filename              |
| `label`    | no       | derived from `id`      | Text on the pad                              |
| `file`     | no       | `sounds/<id>.mp3`      | Use this for `.wav`, `.ogg`, or another path |
| `category` | no       | none                   | Two or more categories add filter chips      |
| `emoji`    | no       | 🔊                     | Icon on the pad                              |
| `key`      | no       | auto-assigned          | Keyboard shortcut, one character             |
| `color`    | no       | cycles through palette | Any CSS color                                |
| `gain`     | no       | `1`                    | Per-pad volume, e.g. `0.6` to tame a loud clip |

Pads whose file is missing are dimmed and struck through — the board checks every
file on load, so you can see at a glance what still needs recording.

## Controls

| Action                      | What it does                    |
| --------------------------- | ------------------------------- |
| Click a pad, or press its key | Play                          |
| `Shift` + click / key       | Play looped                     |
| Right-click a pad           | Stop just that sound            |
| `Esc`, or **Stop**          | Stop everything                 |
| `/`                         | Focus search                    |
| **Solo**                    | Only one sound plays at a time  |
| ☆ on a pad                  | Pin it to the front of the board |

Pinned pads are remembered in `localStorage`, per browser.

## Files

```
index.html    markup
styles.css    styling, light + dark
app.js        manifest loading, Web Audio playback, keyboard handling
sounds.json   your sound list  ← the only file you normally edit
sounds/       your audio clips
```

Playback uses the Web Audio API: each clip is fetched, decoded once, and cached, so
repeat triggers are instant and several pads can overlap.
