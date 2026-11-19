# Lyrics Visualiser

A Mac app that shows beautiful, time-synced lyrics for whatever you're playing on Spotify. Search any song, hit Enter, and the lyrics glow word by word as they're sung. There's also a floating overlay that sits above every app.

## Features
- **Search any song** (⌘K) and play it on your Spotify app, Mac or phone. Spotify Premium is needed for playback control.
- **Follows whatever you play.** Changing a song in Spotify updates the lyrics.
- **8 lyric styles:** Glow, Sweep, Focus, Messages (a realistic iMessage-style conversation with typing dots, reactions and read receipts), Kinetic, Neon, Typewriter and Bounce.
- **Live backgrounds:** Aurora, Particles, Waves, Album art or Solid. Colours come from the album or your own picks and presets, with speed, brightness, blur, film grain, and an option to pulse with each lyric line.
- **Floating overlay** that stays on top of full-screen apps and every Space. It can be locked so clicks pass through. The ♪ menu bar icon toggles it.
- Click any line to jump there, and use the timing offset slider if lyrics run early or late.

## Setup
1. Install Node 20+ and run `npm install`.
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
