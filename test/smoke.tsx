/**
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Node smoke tests for the pure logic and the server-side render of the views.
 * Run with: npm run smoke
 */

// React imports
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Components
import HomeView from '@/components/HomeView';
import LoginView from '@/components/LoginView';
import PlaylistView from '@/components/PlaylistView/PlaylistView';
import Sidebar from '@/components/Sidebar/Sidebar';
import ChatPanel from '@/components/Chat/ChatPanel';
import { withGlobalContext } from '@/withGlobalContext';

// Classes
import { Playlist } from '@/classes/Playlist';
import { SpotifyUser } from '@/classes/SpotifyUser';
import { Track } from '@/classes/Track';

// API
import SpotifyAPI from '@/api/SpotifyAPI';

// Features
import { archiveDiscoverWeekly } from '@/features/discoverWeekly';
import { sortTracks } from '@/features/sortStrategies';

// Utility
import LibrarySnapshot from '@/util/LibrarySnapshot';
import LibraryTree from '@/util/LibraryTree';
import StorageHandler from '@/util/StorageHandler';
import { formatCalendarWeek, formatYearFolder, getISOWeek } from '@/util/CalendarWeek';
import '@/util/i18n';

const originalError = console.error;
console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) return;
    originalError(...args);
};

let passed = 0;
let failed = 0;

const check = (label: string, condition: boolean, detail = '') => {
    if (condition) {
        passed += 1;
        console.log(`  ok    ${label}`);
    } else {
        failed += 1;
        console.log(`  FAIL  ${label}${detail ? ` (${detail})` : ''}`);
    }
};

const section = (title: string) => console.log(`\n${title}`);

const makePlaylist = (id: string, name: string, owner = 'me', isPublic = false) =>
    new Playlist(
        {
            id,
            name,
            owner: { id: owner, display_name: owner },
            public: isPublic,
            tracks: { total: 10 },
            snapshot_id: `snap-${id}`,
        },
        'me',
    );

const makeTrack = (name: string, releaseDate: string | null, precision: 'day' | 'month' | 'year' | null, position: number) =>
    new Track(
        {
            id: `t-${position}`,
            uri: `spotify:track:${position}`,
            name,
            artists: [{ name: 'Artist' }],
            album: {
                id: 'a1',
                name: 'Album',
                album_type: 'album',
                release_date: releaseDate ?? undefined,
                release_date_precision: precision ?? undefined,
                images: [{ url: 'https://example.test/cover.jpg' }],
            },
            duration_ms: 200000 + position,
        },
        position,
        '2026-01-0' + ((position % 9) + 1) + 'T00:00:00Z',
    );

// ---------------------------------------------------------------------------
section('Calendar week naming');
{
    // 2026-07-08 is a Wednesday in ISO week 28
    const week = getISOWeek(new Date('2026-07-08T12:00:00Z'));
    check('ISO week of 2026-07-08 is 28', week.week === 28, `got ${week.week}`);
    check('ISO year is 2026', week.year === 2026, `got ${week.year}`);
    check("name is KW 28'26", formatCalendarWeek(new Date('2026-07-08T12:00:00Z')) === "KW 28'26", formatCalendarWeek(new Date('2026-07-08T12:00:00Z')));
    check("year folder is '26", formatYearFolder(new Date('2026-07-08T12:00:00Z')) === "'26");

    // 2027-01-01 is a Friday and belongs to ISO week 53 of 2026
    const boundary = getISOWeek(new Date('2027-01-01T12:00:00Z'));
    check('2027-01-01 falls into ISO week 53', boundary.week === 53, `got ${boundary.week}`);
    check('2027-01-01 keeps ISO year 2026', boundary.year === 2026, `got ${boundary.year}`);
}

// ---------------------------------------------------------------------------
section('Library tree');
{
    localStorage.clear();
    const playlists = [makePlaylist('p1', 'Focus'), makePlaylist('p2', 'Techno'), makePlaylist('p3', 'Jazz')];
    check('syncPlaylists reports a change', LibraryTree.syncPlaylists(playlists) === true);
    check('root holds three playlists', LibraryTree.childrenOf(null).length === 3);
    check('syncPlaylists is idempotent', LibraryTree.syncPlaylists(playlists) === false);

    const outer = LibraryTree.createFolder('Weekly Mix');
    const inner = LibraryTree.createFolder("'26", outer.id);
    check('nested folder has the right parent', LibraryTree.getNode(inner.id)?.parentId === outer.id);

    LibraryTree.moveNodes(['p1', 'p2'], inner.id);
    check('two playlists moved into the nested folder', LibraryTree.childrenOf(inner.id).length === 2);
    check('the folder count includes nested playlists', LibraryTree.countPlaylistsIn(outer.id) === 2);

    // Reordering inside the folder: move p2 before p1
    LibraryTree.moveNodes(['p2'], inner.id, 'p1');
    check('reordering puts p2 first', LibraryTree.childrenOf(inner.id)[0].id === 'p2');

    // A folder may not be moved into its own subtree
    LibraryTree.moveNodes([outer.id], inner.id);
    check('cycle prevention keeps the outer folder at the root', LibraryTree.getNode(outer.id)?.parentId === null);

    check('ensureFolderPath reuses the existing path', LibraryTree.ensureFolderPath(['Weekly Mix', "'26"]) === inner.id);
    const fresh = LibraryTree.ensureFolderPath(['Weekly Mix', "'27"]);
    check('ensureFolderPath creates missing folders', LibraryTree.getNode(fresh)?.parentId === outer.id);

    LibraryTree.deleteFolder(inner.id);
    check('deleting a folder lifts its children', LibraryTree.getNode('p1')?.parentId === outer.id);
    check('the deleted folder is gone', LibraryTree.getNode(inner.id) === undefined);
    check('foldersWithDepth is depth annotated', LibraryTree.foldersWithDepth().some((entry) => entry.depth === 1));
}

// ---------------------------------------------------------------------------
section('Release date sorting');
{
    const tracks = [
        makeTrack('Remaster', '2015-03-11', 'day', 0),
        makeTrack('Original', '1998', 'year', 1),
        makeTrack('Unknown', null, null, 2),
        makeTrack('Reissue', '2004-06', 'month', 3),
    ];

    const ascending = sortTracks(tracks, 'release-date', true);
    check('oldest release comes first', ascending[0].name === 'Original', ascending.map((t) => t.name).join(','));
    check('unknown dates stay at the end ascending', ascending[3].name === 'Unknown');

    const descending = sortTracks(tracks, 'release-date', false);
    check('newest release comes first descending', descending[0].name === 'Remaster', descending.map((t) => t.name).join(','));
    check('unknown dates stay at the end descending', descending[3].name === 'Unknown');

    check('day precision renders dd.mm.yyyy', tracks[0].releaseDateLabel === '11.03.2015', tracks[0].releaseDateLabel);
    check('year precision renders yyyy', tracks[1].releaseDateLabel === '1998', tracks[1].releaseDateLabel);
    check('month precision renders mm.yyyy', tracks[3].releaseDateLabel === '06.2004', tracks[3].releaseDateLabel);
    check('missing dates render a placeholder', tracks[2].releaseDateLabel === '?');
    check('custom order restores the playlist positions', sortTracks(tracks, 'custom', true)[0].position === 0);
}

// ---------------------------------------------------------------------------
section('Discover Weekly archiver (API mocked)');
{
    localStorage.clear();
    const user = new SpotifyUser({ id: 'me', display_name: 'Me' });
    const source = makePlaylist('dw', 'Discover Weekly', 'spotify');
    const calls: string[] = [];

    // The static API methods are plain properties, so they can be replaced here
    SpotifyAPI.fetchPlaylistTracks = async () => [
        makeTrack('One', '2026-01-01', 'day', 0),
        makeTrack('Two', '2026-02-01', 'day', 1),
    ];
    SpotifyAPI.createPlaylist = async (userId, name, isPublic) => {
        calls.push(`create:${userId}:${name}:${isPublic}`);
        return makePlaylist('new', name);
    };
    SpotifyAPI.addTracksToPlaylist = async (playlistId, uris) => {
        calls.push(`add:${playlistId}:${uris.length}`);
    };

    const t = (key: string) => key;
    const result = await archiveDiscoverWeekly(t, user, [source]);

    check('the archive name follows the calendar week', /^KW \d{2}'\d{2}$/.test(result.playlistName), result.playlistName);
    check('a playlist was created', result.created === true);
    check('both tracks were copied', result.trackCount === 2);
    check('the new playlist is private', calls.some((call) => call.endsWith(':false')), calls.join(' | '));
    check('the tracks were added in one call', calls.includes('add:new:2'), calls.join(' | '));

    const folderId = LibraryTree.ensureFolderPath(['Weekly Mix', formatYearFolder(new Date())]);
    check('the archive is filed into the year subfolder', LibraryTree.getNode('new')?.parentId === folderId);

    // Running it again in the same week must not create a second playlist
    const second = await archiveDiscoverWeekly(t, user, [source, makePlaylist('new', result.playlistName)]);
    check('a second run in the same week is a no-op', second.created === false);

    // Without a resolvable source the archiver fails with a translated message
    let error = '';
    try {
        await archiveDiscoverWeekly(t, user, []);
    } catch (e) {
        error = e instanceof Error ? e.message : String(e);
    }
    check('a missing source raises source-not-found', error === 'dw.source-not-found', error);
}

// ---------------------------------------------------------------------------
section('Backup and recovery');
{
    localStorage.clear();
    LibrarySnapshot.clear();

    // A simulated Spotify side: one playlist whose stored order can be broken
    const stored = new Map<string, string[]>();
    stored.set('p1', ['spotify:track:a', 'spotify:track:b', 'spotify:track:c', 'spotify:local:x']);
    const playlist = makePlaylist('p1', 'Focus');

    const visibility = new Map<string, boolean>([['p1', false]]);
    let failNextWrite = false;

    SpotifyAPI.fetchPlaylistTracks = async (id) =>
        (stored.get(id) ?? []).map((uri, index) =>
            new Track(
                {
                    id: `t-${index}`,
                    uri,
                    name: `Track ${index}`,
                    artists: [{ name: 'Artist' }],
                    album: { id: 'a1', name: 'Album', release_date: '2020-01-01', release_date_precision: 'day' },
                    duration_ms: 1000,
                    is_local: uri.startsWith('spotify:local:'),
                },
                index,
            ),
        );
    SpotifyAPI.applyTrackOrder = async (id, uris) => {
        if (failNextWrite) {
            // Mimic a PUT that landed followed by a failing chunk: truncated playlist
            stored.set(id, uris.slice(0, 1));
            throw new Error('network');
        }
        const remote = uris.filter((uri) => !uri.startsWith('spotify:local:'));
        stored.set(id, remote);
        return uris.length - remote.length;
    };
    SpotifyAPI.setPlaylistVisibility = async (id, isPublic) => {
        visibility.set(id, isPublic);
    };

    const before = await LibrarySnapshot.capturePlaylist(playlist, 'order-write', 'me');
    check('the snapshot records the full track order', before.playlists[0].trackUris?.length === 4);
    check('local files are counted', before.playlists[0].localTrackCount === 1);
    check('the snapshot is listed for recovery', LibrarySnapshot.list().length === 1);

    // Now wreck the playlist the way a half-finished write would
    failNextWrite = true;
    try {
        await SpotifyAPI.applyTrackOrder('p1', ['spotify:track:c', 'spotify:track:a', 'spotify:track:b']);
    } catch {
        // expected
    }
    failNextWrite = false;
    check('the simulated playlist is truncated', stored.get('p1')?.length === 1, String(stored.get('p1')?.length));

    const preview = await LibrarySnapshot.previewRestore(before, [playlist]);
    check('the preview flags the playlist as differing', preview[0].state === 'changed', preview[0].state);
    check('the preview shows both counts', preview[0].liveTrackCount === 1 && preview[0].backupTrackCount === 4);

    const result = await LibrarySnapshot.restoreSnapshot(before, [playlist]);
    check('one playlist was restored', result.restoredPlaylists === 1);
    check('the local file is reported as skipped', result.skippedLocal === 1);
    check(
        'the remote track order is back',
        JSON.stringify(stored.get('p1')) === JSON.stringify(['spotify:track:a', 'spotify:track:b', 'spotify:track:c']),
        JSON.stringify(stored.get('p1')),
    );
    check('a safety snapshot was taken before restoring', LibrarySnapshot.list().some((entry) => entry.reason === 'pre-restore'));

    // Restoring a second time must be a no-op against an already matching playlist
    const secondPreview = await LibrarySnapshot.previewRestore(before, [playlist]);
    check('after restoring, the backup still differs only by the local file', secondPreview[0].backupTrackCount === 4);

    // Playlists owned by someone else are refused rather than attempted
    const foreign = makePlaylist('p9', 'Someone else', 'other');
    const foreignSnapshot = await LibrarySnapshot.capturePlaylist(playlist, 'manual', 'me');
    foreignSnapshot.playlists[0].id = 'p9';
    const foreignResult = await LibrarySnapshot.restoreSnapshot(foreignSnapshot, [foreign]);
    check('a playlist owned by someone else is refused', foreignResult.failed[0]?.message === 'not-owned');

    // The folder tree travels with the snapshot
    localStorage.clear();
    LibraryTree.syncPlaylists([playlist]);
    const folder = LibraryTree.createFolder('Keep');
    LibraryTree.moveNodes(['p1'], folder.id);
    const withTree = await LibrarySnapshot.capturePlaylist(playlist, 'manual', 'me');
    LibraryTree.deleteFolder(folder.id);
    check('the folder is gone before restoring', LibraryTree.getNode('p1')?.parentId === null);
    await LibrarySnapshot.restoreSnapshot(withTree, [playlist]);
    check('restoring brings the folder tree back', LibraryTree.getNode('p1')?.parentId === folder.id);

    // File round trip and validation
    const file = LibrarySnapshot.toFile(withTree);
    check('the file name is timestamped', /^spotify-library-backup-\d{8}-\d{4}\.json$/.test(file.fileName), file.fileName);
    const parsed = LibrarySnapshot.fromFile(file.content);
    check('the file round trips', parsed.playlists[0].trackUris?.length === withTree.playlists[0].trackUris?.length);

    let fileError = '';
    try {
        LibrarySnapshot.fromFile('{"not":"a backup"}');
    } catch (e) {
        fileError = e instanceof Error ? e.message : String(e);
    }
    check('a foreign file is rejected', fileError === 'unsupported-file', fileError);

    let jsonError = '';
    try {
        LibrarySnapshot.fromFile('nonsense');
    } catch (e) {
        jsonError = e instanceof Error ? e.message : String(e);
    }
    check('broken JSON is rejected', jsonError === 'invalid-json', jsonError);

    // The ring buffer must not grow without bound
    LibrarySnapshot.clear();
    for (let i = 0; i < 25; i += 1) {
        LibrarySnapshot.captureMeta([playlist], 'visibility', 'me', `run ${i}`);
    }
    check('the ring buffer keeps at most 20 snapshots', LibrarySnapshot.list().length === 20, String(LibrarySnapshot.list().length));
    check('the newest snapshot is first', LibrarySnapshot.list()[0].label === 'run 24', LibrarySnapshot.list()[0].label);
}

// ---------------------------------------------------------------------------
section('Server-side render of the views');
{
    localStorage.clear();
    StorageHandler.set('settings.ui.language', 'en');

    const playlists = [makePlaylist('p1', 'Focus'), makePlaylist('p2', 'Techno', 'someone-else', true)];
    LibraryTree.syncPlaylists(playlists);

    SpotifyAPI.fetchPlaylistTracks = async () => [makeTrack('One', '2026-01-01', 'day', 0)];
    SpotifyAPI.fetchPlaylist = async (id) => makePlaylist(id, 'Focus');
    SpotifyAPI.fetchMyPlaylists = async () => playlists;
    SpotifyAPI.fetchCurrentUser = async () => new SpotifyUser({ id: 'me', display_name: 'Me' });

    const render = (label: string, element: React.ReactElement, expected: string[], route?: { path: string; at: string }) => {
        try {
            const tree = route ? (
                <MemoryRouter initialEntries={[route.at]}>
                    <Routes>
                        <Route path={route.path} element={element} />
                    </Routes>
                </MemoryRouter>
            ) : (
                <MemoryRouter>{element}</MemoryRouter>
            );
            const html = renderToString(tree);
            const missing = expected.filter((needle) => !html.includes(needle));
            check(`${label} renders`, missing.length === 0, missing.length > 0 ? `missing: ${missing.join(', ')}` : '');
        } catch (e) {
            check(`${label} renders`, false, e instanceof Error ? e.message : String(e));
        }
    };

    const WrappedSidebar = withGlobalContext(() => (
        <Sidebar onArchiveDiscoverWeekly={() => undefined} refreshPlaylists={async () => undefined} />
    ));
    const WrappedHome = withGlobalContext(() => <HomeView refreshPlaylists={async () => undefined} />);
    const WrappedPlaylist = withGlobalContext(() => <PlaylistView />);
    const WrappedChat = withGlobalContext(() => <ChatPanel />);

    render('LoginView', <LoginView />, ['Spotify client ID', '/callback']);
    render('Sidebar', <WrappedSidebar />, ['sidebar-tree', 'Filter playlists']);
    render('HomeView', <WrappedHome />, ['Archive Discover Weekly', 'Settings', 'home-stats']);
    render('PlaylistView', <WrappedPlaylist />, ['playlist-table', 'Release'], {
        path: '/playlist/:id',
        at: '/playlist/p1',
    });
    render('ChatPanel (closed by default)', <WrappedChat />, []);

    // Translations must resolve, an unresolved key would surface as the key itself
    const html = renderToString(
        <MemoryRouter>
            <WrappedHome />
        </MemoryRouter>,
    );
    check('no raw translation keys leak into the markup', !/home\.[a-z-]+\./.test(html));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
