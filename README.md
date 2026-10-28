# Spotify Library Manager

A personal React app for organizing your own Spotify library: virtual folders, mass actions,
release-date work on tracks, a one-click Discover Weekly archive and a chat panel that talks to
your own local LLM backend over WebSocket. There is deliberately no browse or discovery UI, the
app only ever looks at your library.

## Setup

1. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Add this exact redirect URI to the app: `http://127.0.0.1:5173/callback`
   Spotify no longer accepts `localhost`, only loopback IP literals or HTTPS, so the dev server is
   pinned to `127.0.0.1:5173` in `vite.config.ts`.
3. Install and run:
   ```bash
   npm install
   npm run dev
   ```
4. Open `http://127.0.0.1:5173`, paste the client ID from the dashboard into the login view and
   connect. The client ID is stored in localStorage only. Alternatively put it into `.env.local`:
   ```
   VITE_SPOTIFY_CLIENT_ID=your-client-id
   ```

Authentication uses the Authorization Code flow with PKCE. There is no server component and no
client secret; the implicit grant Spotify used to offer was removed and is not used here.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server on `127.0.0.1:5173` |
| `npm run build` | Typecheck plus production build |
| `npm run smoke` | Node smoke tests (logic plus server-side render of every view) |

## Features

**Library tree.** The sidebar renders a folder tree over your playlists. Folders can be nested,
renamed by double-click and deleted (children move up one level, nothing is touched in Spotify).
Drag a row onto the upper or lower third of a folder to place it before or after, onto the middle
to drop it inside. Playlists reorder by dragging onto the top or bottom half of another row.

**Mass actions.** The checkbox on each playlist row feeds a floating toolbar: make public, make
private, move to folder. Playlists owned by other users are skipped with a count, because the API
rejects visibility changes on them. Dragging a selected playlist drags the whole selection.

**Discover Weekly archive.** One button copies the current Discover Weekly into a new private
playlist named after the ISO calendar week (`KW 28'26`) and files it into `Weekly Mix` > `'26`.
Running it twice in the same week is a no-op. Available from the home view and the sidebar.

**Release dates.** Every track row shows a release-date chip, color-coded by precision: green for
an exact date, yellow for month-only, gray for year-only. Sorting by release date is one of the
strategies in the sort dropdown; unknown dates always stay at the end, in both directions. For
playlists you own, the current sort order can be written back to Spotify.

**Variants.** Clicking a track opens the variants panel: other releases of the same title by the
same artist (single, album, remaster, compilation), sorted oldest first with their release dates.
"Use" swaps that release into the playlist at the same position, which is how you replace a
compilation copy dated 2015 with the original single dated 1998.

**Chat.** The right-hand panel connects to a WebSocket backend of your own. Playlists, tracks and
release variants can be dragged into it; each becomes a metadata attachment sent with the next
message. Playlist attachments resolve their full track list (names, artists, albums, release dates,
URIs) in the background.

## Backup and recovery

Every write that can damage a playlist takes a snapshot first, so nothing in this app is a
one-way door.

**Automatic snapshots.** Before writing a sort order or swapping a track variant, the full track
URI order of that playlist is captured. Before a mass visibility change, the flags are captured.
The last 20 snapshots live in localStorage under `backups.snapshots` and are listed on the home
view with their reason, playlist, timestamp and size. Each one can be restored, saved to a file or
deleted.

**Full backup.** "Download full backup" walks every playlist and writes a timestamped JSON file
containing the track order, metadata flags and the folder tree. This matters more than it sounds:
the folder tree exists only in this browser, so the file is its only redundancy. The walk costs
one request per 100 tracks per playlist, so it is slow on large libraries and shows progress.

**Restoring.** Both sources go through the same path. The app first compares the backup against
your live library and shows, per playlist, whether it is unchanged, differs or is gone, with the
track counts on both sides. Only after you confirm does it write. A safety snapshot of the current
state is taken before the first write, so a restore can itself be rolled back.

Three things a restore cannot do, by API constraint rather than by choice:

- Local files (`spotify:local:` URIs) cannot be re-added. They are counted and reported.
- The original "added at" timestamps are lost; restored tracks count as added today.
- Deleted playlists cannot be recreated under their old ID. Bring them back first from the Spotify
  account page under Recover playlists, which keeps them for 90 days, then restore the order here.

Note that Spotify's own recovery only covers whole deleted playlists. It does nothing for a track
order that was overwritten or a track removed inside a playlist that still exists, which is exactly
the gap these snapshots fill.

## API limitations, and what this app does about them

These are real constraints of the Spotify Web API, not gaps in the implementation.

**Folders do not exist in the API.** Spotify has no public endpoints for playlist folders, and the
order of the library sidebar is not writable either. Only private, undocumented endpoints do this,
and they break without notice. So the folder tree and the custom order live in `LibraryTree`
(localStorage, key `library.tree.nodes`). They are app-internal: real and persistent for you, but
invisible in the Spotify clients. If that ever changes, `LibraryTree` is the only file that would
need to learn about a server.

**Algorithmic playlists are gated.** Since late November 2024, apps without an approved quota
extension get a 404 for Spotify-owned and algorithmic playlists, and Discover Weekly is filtered
out of `/me/playlists`. The archiver therefore tries, in order: the playlist ID configured under
`settings.spotify.dwSourceId` (home view > settings), then a playlist named `Discover Weekly` in
your library. If neither resolves, it says so instead of failing silently. The practical workaround
is to keep a mirror playlist of your own and point the setting at it.

**Local files.** Tracks with `spotify:local:` URIs cannot be re-added through the API. Writing a
sort order skips them and reports how many were left out.

## Architecture

```
src/
  api/            SpotifyAuth (PKCE), SpotifyAPI (all endpoints), LLMSocket (chat transport)
  classes/        BaseEntity, Playlist, Track, SpotifyUser
  components/     Views and shared UI, each with its own _style/ folder
  features/       sortStrategies, bulkActions, discoverWeekly
  util/           LibraryTree, LibrarySnapshot, StorageHandler, CalendarWeek, DragPayload, i18n
  _lang/          en.json, de.json (single 'app' namespace)
  _style/         _variables.scss (design tokens, injected into every SCSS file)
  withGlobalContext.tsx   Global state via the createContextProvider pattern
  Client.tsx      Shell: auth gate, library load, layout
```

Three registries make the app extensible without touching components:

- `features/sortStrategies.ts`, add an entry and it appears in the sort dropdown.
- `features/bulkActions.ts`, add an entry and it appears in the selection toolbar.
- `components/Icon.tsx`, add a path and it is available to every button.

State lives in `withGlobalContext.tsx` and follows the tuple convention
(`playlists: [playlists, setPlaylists]`). API access is static classes only; nothing calls `fetch`
directly. Errors surface through `react-hot-toast`, never as silent failures.

## Chat protocol

The panel speaks JSON over a plain WebSocket, default `ws://127.0.0.1:8765` (configurable in the
home view or the panel's settings toggle).

Client to server:

```json
{
  "type": "chat",
  "version": 1,
  "id": "msg-1770000000000-a1b2c3",
  "text": "Which of these tracks has the wrong release date?",
  "attachments": [
    {
      "kind": "playlist",
      "id": "37i9dQZF1DX0XUsuxWHRQd",
      "name": "Focus",
      "subtitle": "128 tracks",
      "meta": {
        "uri": "spotify:playlist:37i9dQZF1DX0XUsuxWHRQd",
        "owner": "me",
        "trackCount": 128,
        "public": false,
        "tracks": [
          {
            "name": "Track name",
            "artists": ["Artist"],
            "album": "Album",
            "releaseDate": "1998-04-13",
            "releaseDatePrecision": "day",
            "uri": "spotify:track:..."
          }
        ]
      }
    }
  ]
}
```

`kind` is `playlist`, `track` or `album`. Server to client:

```json
{ "type": "chat",   "id": "optional", "text": "Reply text" }
{ "type": "status", "text": "Thinking ..." }
{ "type": "error",  "text": "Model unavailable" }
```

`chat` renders as an assistant message, `status` as a centered system line, `error` as a toast.
Plain text that is not JSON is tolerated and shown as an assistant message, which is handy while
building the backend. To change the wire format, `api/LLMSocket.ts` is the only file involved.

## Tests

`npm run smoke` bundles the modules with esbuild and runs them in node against minimal browser
shims. It covers ISO calendar-week naming across the year boundary, the folder tree (nesting,
reordering, cycle prevention, deletion, path creation), release-date sorting and label precision,
the Discover Weekly archiver against a mocked API, and a server-side render of every view including
a check that no untranslated keys leak into the markup.

The backup section is the one worth knowing about: it simulates a half-finished order write that
truncates a playlist to a single track, then proves the snapshot restores the original order, that
local files are reported rather than silently dropped, that the folder tree comes back, that
playlists owned by someone else are refused instead of attempted, that the file round trips and
foreign files are rejected, and that the ring buffer stays at 20 entries.

The suite deliberately does not hit the Spotify API. Anything involving real OAuth, real playlists
or the chat backend has to be exercised in the browser against your own account.
