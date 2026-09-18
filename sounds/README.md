# Audio files

Drop your clips in this folder. A manifest entry with `"id": "airhorn"` looks for
`sounds/airhorn.mp3` by default — set `"file"` on the entry to point somewhere else
or to use a different extension.

- **Formats:** MP3 is the safest cross-browser bet. WAV, OGG and M4A also work in
  current browsers; WAV files are much larger.
- **Length:** keep effects short (under ~10s). They're decoded fully into memory.
- **Volume:** if one clip is louder than the rest, don't re-edit it — set
  `"gain": 0.6` on that entry in `sounds.json`.

This folder is tracked by git, so committed clips ship with the app. Audio files are
binary and don't diff well; keep them small.

## Files this board is looking for

| Filename                     | Effect                                    |
| ---------------------------- | ----------------------------------------- |
| `metronome.mp3`              | A single short tick or click (see below)  |
| `door-slam.mp3`              | Wooden door slam                          |
| `gunshot-victorian.mp3`      | Victorian-era gunshot                     |
| `scream-man.mp3`             | Man screaming                             |
| `scream-woman.mp3`           | Woman screaming                           |
| `scream-child.mp3`           | Child screaming                           |
| `scream-terror.mp3`          | Blood-curdling scream                     |
| `scream-distant.mp3`         | Distant scream (trimmed to `gain: 0.7`)   |
| `scream-yelp.mp3`            | Short yelp                                |

The metronome is the odd one out: supply **one tick**, not a looping bar of them.
The board repeats it at whatever tempo the pad is set to, so a clip with its own
built-in rhythm would fight the BPM control.

Prefer clips trimmed tight to the transient — a door slam with half a second of
silence in front of it feels broken however good the recording is.
