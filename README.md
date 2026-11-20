# Lyrics Visualiser

A Mac app that shows beautiful, time-synced lyrics for whatever you're playing on Spotify. Search any song, hit Enter, and the lyrics glow word by word as they're sung. There's also a floating overlay that sits above every app.

## Features
- **Search any song** (⌘K) and play it on your Spotify app, Mac or phone. Spotify Premium is needed for playback control.
- **Follows whatever you play.** Changing a song in Spotify updates the lyrics.
- **8 lyric styles:** Glow, Sweep, Focus, Messages (a realistic iMessage-style conversation with typing dots, reactions and read receipts), Kinetic, Neon, Typewriter and Bounce.
- **Live backgrounds:** Aurora, Particles, Waves, Album art or Solid. Colours come from the album or your own picks and presets, with speed, brightness, blur, film grain, and an option to pulse with each lyric line.
- **Floating overlay** that stays on top of full-screen apps and every Space. It can be locked so clicks pass through. The ♪ menu bar icon toggles it.
- Click any line to jump there. Use `[` and `]` to nudge timing for the current song; it is remembered per song.
- **Customise** fonts, weight, alignment, sung-word colour, glow, dimming, blur, animation speed, ALL CAPS, background, overlay size and backdrop, and auto-hiding controls.
- Shortcuts: Space play/pause, ←/→ seek 5s, N/P next/previous, 1–8 styles, ⌘K search, O overlay, F full screen, S customise.

## How it connects
- **Spotify app on this Mac (automatic, no sign-in).** Like DJ apps, it reads the Spotify desktop app directly, so lyrics follow along with no setup, no rate limits and millisecond-accurate timing. macOS asks once for permission to control Spotify. Play, pause, skip, seek and playing a searched song all go through the app, and playing a specific song works without Premium.
- **Spotify account (optional, one-time).** Needed for search, and to follow playback on your phone or speakers.

## Setup
1. Install Node 20+ and run `npm install`. This also downloads the Electron binary; if it was interrupted, `npm run dev` retries it.
2. Create an app at https://developer.spotify.com/dashboard:
   - Redirect URI: `http://127.0.0.1:43821/callback`
   - APIs used: **Web API**
3. Run `npm run dev`, paste the app's Client ID into the setup screen, and click **Connect Spotify**.

Your Spotify tokens are encrypted with the macOS Keychain (Electron `safeStorage`). No client secret is used: sign-in uses Spotify's PKCE flow.

## Build a .app / .dmg
```
npm run dist:mac
```
The output goes to `dist/`. The build is unsigned, so on first launch right-click the app and choose **Open**.

## How it works
- **Spotify Web API** handles search, playback (`/me/player/play`) and the current position, polled once a second and interpolated every frame.
- **Lyrics come from [LRCLIB](https://lrclib.net)**, a free, open database of timestamped (LRC) lyrics. Spotify's public API has no lyrics endpoint. Most LRCLIB lyrics are timed per line, so word timing is estimated within each line from word length. Enhanced LRC with real word timings is used when available.
- Stack: Electron, React and TypeScript, built with electron-vite.

## Scripts
| | |
|---|---|
| `npm run dev` | Run with hot reload |
| `npm test` | LRC parser tests |
| `npm run typecheck` | TypeScript |
| `npm run dist:mac` | Package a .dmg |

## Roadmap
- Lock-screen lyrics (stretch goal)
- More styles and a font picker
- Apple Music support
