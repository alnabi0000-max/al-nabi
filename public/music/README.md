# Producer background music

Drop licensed tracks here. Producer picks a file by mood and mixes it under VO + Foley at ~−20 dB (looped/trimmed to clip length with soft fade).

**Pricing:** BGM is included in the existing video NC cost — no separate charge (local FFmpeg only, no external music API).

If a mood folder is empty, Producer falls back to any other folder that has tracks. If nothing is present yet, render continues without BGM.

## Folders

| Folder | Mood |
|--------|------|
| `calm/` | peaceful, soft, reflective |
| `epic/` | cinematic, heroic, grand |
| `suspense/` | tense, dramatic, dark |
| `upbeat/` | joyful, energetic, bright |

Suggested start: 2–4 tracks per folder (10–15 total). One solid `epic/` track is enough for a first smoke test.

## Formats

`.mp3`, `.m4a`, `.wav`, `.ogg`, `.aac`

## Sources (approved)

- [Pixabay Music](https://pixabay.com/music) — free, no attribution required
- [YouTube Audio Library](https://studio.youtube.com) — safest for YouTube monetization

Add each track to `MUSIC_CREDITS.md` when you drop files in.

Do **not** use AI music generators (Suno, etc.) until license policy is decided.
Mubert / generative APIs are a later stage — not used here.
