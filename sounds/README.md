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
