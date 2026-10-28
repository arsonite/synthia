/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Static wrapper around the Spotify Web API. Every call goes through
 * request(), which handles authentication, rate limiting and token refresh.
 */

// Classes
import { Playlist, IPlaylistRaw } from '@/classes/Playlist';
import { SpotifyUser, ISpotifyUserRaw } from '@/classes/SpotifyUser';
import { Track, IPlaylistItemRaw, ITrackRaw } from '@/classes/Track';

// API
import SpotifyAuth from './SpotifyAuth';

// Utility
import Config from '@/config';

// The track fields requested for playlist items. Keeping the projection small
// speeds up pagination on large playlists considerably.
const PLAYLIST_ITEM_FIELDS =
    'next,items(added_at,is_local,track(id,uri,name,type,duration_ms,popularity,explicit,is_local,' +
    'artists(name),album(id,name,album_type,release_date,release_date_precision,images)))';

interface IPagedResponse<T> {
    items: T[];
    next: string | null;
}

interface ISearchResponse {
    tracks?: {
        items: ITrackRaw[];
    };
}

/**
 * Error thrown for non-successful Spotify API responses.
 * Carries the HTTP status so callers can react to specific cases (e.g. 404).
 */
export class SpotifyAPIError extends Error {
    public readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'SpotifyAPIError';
        this.status = status;
    }
}

/**
 * SpotifyAPI provides typed access to the Spotify Web API endpoints
 * used by this application. All methods are static.
 */
class SpotifyAPI {
    /**
     * Performs an authenticated request against the Spotify Web API.
     * Waits on 429 rate limits and retries once after a token refresh on 401.
     * @param method - The HTTP method.
     * @param endpoint - Endpoint path relative to the API base, or a full URL.
     * @param body - Optional JSON body.
     * @param retried - Internal flag to prevent endless refresh loops.
     * @returns The parsed JSON response.
     */
    private static readonly request = async <T>(
        method: 'GET' | 'POST' | 'PUT' | 'DELETE',
        endpoint: string,
        body?: unknown,
        retried = false,
    ): Promise<T> => {
        const token = await SpotifyAuth.getValidAccessToken();
        const url = endpoint.startsWith('http') ? endpoint : `${Config.spotify.apiBaseURL}${endpoint}`;

        const response = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });

        // Rate limited: wait for the advertised amount of time and retry
        if (response.status === 429) {
            const retryAfter = Number(response.headers.get('Retry-After') ?? '1');
            await new Promise((resolve) => setTimeout(resolve, (retryAfter + 1) * 1000));
            return SpotifyAPI.request<T>(method, endpoint, body, retried);
        }

        // Expired token that slipped through: refresh once and retry
        if (response.status === 401 && !retried) {
            await SpotifyAuth.refresh();
            return SpotifyAPI.request<T>(method, endpoint, body, true);
        }

        if (!response.ok) {
            let message = `Spotify API error ${response.status}`;
            try {
                const errorBody = await response.json();
                if (errorBody?.error?.message) message = errorBody.error.message;
            } catch {
                // Keep the generic message if the body is not JSON
            }
            throw new SpotifyAPIError(response.status, message);
        }

        // Some endpoints (e.g. PUT /playlists/{id}) return an empty body
        const text = await response.text();
        return (text ? JSON.parse(text) : null) as T;
    };

    /**
     * Collects all items of a paginated endpoint by following the next links.
     * @param firstEndpoint - The endpoint of the first page.
     * @returns All items across all pages.
     */
    private static readonly getPagedItems = async <T>(firstEndpoint: string): Promise<T[]> => {
        const items: T[] = [];
        let endpoint: string | null = firstEndpoint;

        while (endpoint !== null) {
            const page: IPagedResponse<T> = await SpotifyAPI.request<IPagedResponse<T>>('GET', endpoint);
            items.push(...(page.items ?? []));
            endpoint = page.next;
        }

        return items;
    };

    /**
     * Fetches the profile of the authenticated user.
     * @returns The current user.
     */
    public static readonly fetchCurrentUser = async (): Promise<SpotifyUser> => {
        const raw = await SpotifyAPI.request<ISpotifyUserRaw>('GET', '/me');
        return new SpotifyUser(raw);
    };

    /**
     * Fetches all playlists of the current user's library.
     * @param currentUserId - The current user's id, used to flag own playlists.
     * @returns All playlists in library order.
     */
    public static readonly fetchMyPlaylists = async (currentUserId: string | null): Promise<Playlist[]> => {
        const rawItems = await SpotifyAPI.getPagedItems<IPlaylistRaw>('/me/playlists?limit=50');
        return rawItems.filter((raw) => raw && raw.id).map((raw) => new Playlist(raw, currentUserId));
    };

    /**
     * Fetches a single playlist by id.
     * @param id - The playlist id.
     * @param currentUserId - The current user's id, used to flag own playlists.
     * @returns The playlist.
     */
    public static readonly fetchPlaylist = async (id: string, currentUserId: string | null): Promise<Playlist> => {
        const raw = await SpotifyAPI.request<IPlaylistRaw>('GET', `/playlists/${id}`);
        return new Playlist(raw, currentUserId);
    };

    /**
     * Fetches all tracks of a playlist. Episodes and unavailable tracks are
     * filtered out; local files are kept but flagged.
     * @param id - The playlist id.
     * @returns All tracks with their original positions.
     */
    public static readonly fetchPlaylistTracks = async (id: string): Promise<Track[]> => {
        const endpoint = `/playlists/${id}/tracks?limit=100&fields=${encodeURIComponent(PLAYLIST_ITEM_FIELDS)}`;
        const rawItems = await SpotifyAPI.getPagedItems<IPlaylistItemRaw>(endpoint);

        const tracks: Track[] = [];
        rawItems.forEach((item, position) => {
            if (!item.track) return; // Removed or unavailable
            if ((item.track as { type?: string }).type === 'episode') return; // Podcast episodes
            tracks.push(Track.fromPlaylistItem(item, position));
        });

        return tracks;
    };

    /**
     * Creates a new playlist for the given user.
     * @param userId - The owning user's id.
     * @param name - The playlist name.
     * @param isPublic - Whether the playlist is public.
     * @param description - Optional description.
     * @returns The created playlist.
     */
    public static readonly createPlaylist = async (
        userId: string,
        name: string,
        isPublic: boolean,
        description = '',
    ): Promise<Playlist> => {
        const raw = await SpotifyAPI.request<IPlaylistRaw>('POST', `/users/${userId}/playlists`, {
            name,
            public: isPublic,
            description,
        });
        return new Playlist(raw, userId);
    };

    /**
     * Adds tracks to a playlist in chunks of 100 (API limit).
     * @param playlistId - The target playlist id.
     * @param uris - The track URIs to add.
     */
    public static readonly addTracksToPlaylist = async (playlistId: string, uris: string[]): Promise<void> => {
        for (let i = 0; i < uris.length; i += 100) {
            const chunk = uris.slice(i, i + 100);
            await SpotifyAPI.request('POST', `/playlists/${playlistId}/tracks`, { uris: chunk });
        }
    };

    /**
     * Sets the public/private visibility of a playlist.
     * @param playlistId - The playlist id.
     * @param isPublic - The new visibility.
     */
    public static readonly setPlaylistVisibility = async (playlistId: string, isPublic: boolean): Promise<void> => {
        await SpotifyAPI.request('PUT', `/playlists/${playlistId}`, { public: isPublic });
    };

    /**
     * Replaces a single track occurrence at a specific position with another
     * track, keeping the position. Fetches a fresh snapshot id first so the
     * position-based removal is applied to the correct playlist revision.
     * @param playlistId - The playlist id.
     * @param position - The zero-based position of the occurrence to replace.
     * @param oldUri - The URI of the track currently at that position.
     * @param newUri - The URI of the replacement track.
     */
    public static readonly replaceTrackAtPosition = async (
        playlistId: string,
        position: number,
        oldUri: string,
        newUri: string,
    ): Promise<void> => {
        const playlist = await SpotifyAPI.request<{ snapshot_id: string }>(
            'GET',
            `/playlists/${playlistId}?fields=snapshot_id`,
        );

        await SpotifyAPI.request('DELETE', `/playlists/${playlistId}/tracks`, {
            tracks: [{ uri: oldUri, positions: [position] }],
            snapshot_id: playlist.snapshot_id,
        });

        await SpotifyAPI.request('POST', `/playlists/${playlistId}/tracks`, {
            uris: [newUri],
            position,
        });
    };

    /**
     * Overwrites the track order of a playlist with the given URI sequence.
     * The first 100 tracks replace the playlist content, the rest is appended
     * in chunks. Local files cannot be re-added via the API and are skipped.
     * @param playlistId - The playlist id.
     * @param uris - The full track URI sequence in the desired order.
     * @returns The number of skipped local tracks.
     */
    public static readonly applyTrackOrder = async (playlistId: string, uris: string[]): Promise<number> => {
        const remoteUris = uris.filter((uri) => !uri.startsWith('spotify:local:'));
        const skipped = uris.length - remoteUris.length;

        const head = remoteUris.slice(0, 100);
        await SpotifyAPI.request('PUT', `/playlists/${playlistId}/tracks`, { uris: head });

        for (let i = 100; i < remoteUris.length; i += 100) {
            const chunk = remoteUris.slice(i, i + 100);
            await SpotifyAPI.request('POST', `/playlists/${playlistId}/tracks`, { uris: chunk });
        }

        return skipped;
    };

    /**
     * Searches for variants of a track (same title and main artist across
     * different releases such as singles, albums and compilations).
     * @param title - The track title.
     * @param artist - The main artist name.
     * @returns Matching tracks as returned by the search endpoint.
     */
    public static readonly searchTrackVariants = async (title: string, artist: string): Promise<Track[]> => {
        const query = encodeURIComponent(`track:"${title}" artist:"${artist}"`);
        const response = await SpotifyAPI.request<ISearchResponse>(
            'GET',
            `/search?q=${query}&type=track&limit=50`,
        );

        const rawTracks = response.tracks?.items ?? [];
        return rawTracks.map((raw, index) => new Track(raw, index));
    };
}

export default SpotifyAPI;
