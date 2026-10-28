/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * The Discover Weekly archiver. Copies the current Discover Weekly into a
 * new playlist named after the calendar week (KW XX'YY) and files it into
 * the virtual folder "Weekly Mix" > "'YY".
 *
 * Note on API access: since late 2024 the Web API only exposes algorithmic
 * playlists like Discover Weekly to apps with an approved quota extension.
 * If direct access fails, the source can be overridden with any playlist id
 * (e.g. a self-made mirror) via settings.spotify.dwSourceId.
 */

// Classes
import { Playlist } from '@/classes/Playlist';
import { SpotifyUser } from '@/classes/SpotifyUser';

// API
import SpotifyAPI, { SpotifyAPIError } from '@/api/SpotifyAPI';

// Utility
import Config from '@/config';
import LibraryTree from '@/util/LibraryTree';
import StorageHandler from '@/util/StorageHandler';
import { formatCalendarWeek, formatYearFolder } from '@/util/CalendarWeek';

// Types
import { tTranslationFunction } from '@/util/i18n.types';

export interface IArchiveResult {
    playlistName: string;
    created: boolean;
    trackCount: number;
}

/**
 * Resolves the Discover Weekly source playlist. Tries the manual override
 * first, then scans the user's library for the playlist by name.
 * @param t - The translation function for error messages.
 * @param playlists - The user's playlists.
 * @returns The source playlist.
 */
const resolveSourcePlaylist = async (t: tTranslationFunction, playlists: Playlist[]): Promise<Playlist> => {
    const overrideId = StorageHandler.get('settings.spotify.dwSourceId', null) as string | null;

    if (overrideId) {
        try {
            return await SpotifyAPI.fetchPlaylist(overrideId, null);
        } catch (e) {
            const status = e instanceof SpotifyAPIError ? e.status : '?';
            throw new Error(t('dw.override-failed', { status }));
        }
    }

    const match = playlists.find(
        (playlist) => playlist.name.toLowerCase() === Config.discoverWeekly.sourcePlaylistName.toLowerCase(),
    );
    if (match) return match;

    throw new Error(t('dw.source-not-found'));
};

/**
 * Archives the current Discover Weekly as "KW XX'YY" and files it into
 * "Weekly Mix" > "'YY". Running it twice in the same week is a no-op.
 * @param t - The translation function, scoped to the 'home' key prefix.
 * @param user - The current user.
 * @param playlists - The user's playlists (used to detect existing archives).
 * @returns The archive result.
 */
export const archiveDiscoverWeekly = async (
    t: tTranslationFunction,
    user: SpotifyUser,
    playlists: Playlist[],
): Promise<IArchiveResult> => {
    const now = new Date();
    const playlistName = formatCalendarWeek(now); // e.g. KW 28'26
    const folderId = LibraryTree.ensureFolderPath([
        Config.discoverWeekly.folderName, // Weekly Mix
        formatYearFolder(now), // '26
    ]);

    // Already archived this week: just make sure it is filed correctly
    const existing = playlists.find((playlist) => playlist.isOwn && playlist.name === playlistName);
    if (existing) {
        LibraryTree.moveNodes([existing.id], folderId);
        return { playlistName, created: false, trackCount: existing.trackCount };
    }

    const source = await resolveSourcePlaylist(t, playlists);
    const tracks = await SpotifyAPI.fetchPlaylistTracks(source.id);
    const uris = tracks.filter((track) => !track.isLocal && track.uri).map((track) => track.uri);

    if (uris.length === 0) {
        throw new Error(t('dw.source-empty'));
    }

    const created = await SpotifyAPI.createPlaylist(
        user.id,
        playlistName,
        false,
        t('dw.description', { source: source.name }),
    );
    await SpotifyAPI.addTracksToPlaylist(created.id, uris);
    LibraryTree.fileNewPlaylist(created.id, playlistName, folderId);

    return { playlistName, created: true, trackCount: uris.length };
};
