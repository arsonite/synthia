/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Backup and recovery. Every destructive write in this app (writing a sort
 * order, replacing a track, changing visibility) takes a snapshot first, so
 * a failed or regretted write can be rolled back.
 *
 * A snapshot holds the track URI order and the metadata flags of one or more
 * playlists plus the virtual folder tree. Restoring replays that order back
 * into Spotify. What cannot be restored is documented on restoreSnapshot().
 */

// Classes
import { Playlist } from '@/classes/Playlist';

// API
import SpotifyAPI from '@/api/SpotifyAPI';

// Utility
import LibraryTree, { ITreeNode } from '@/util/LibraryTree';
import StorageHandler from '@/util/StorageHandler';

const STORAGE_KEY = 'backups.snapshots';
const SNAPSHOT_VERSION = 1;

/** How many automatic snapshots are kept before the oldest ones are dropped */
const MAX_SNAPSHOTS = 20;

export type TSnapshotReason = 'order-write' | 'track-replace' | 'visibility' | 'pre-restore' | 'manual';

export interface ISnapshotPlaylist {
    id: string;
    name: string;
    description: string;
    isPublic: boolean | null;
    isCollaborative: boolean;
    ownerId: string;
    isOwn: boolean;
    /** The snapshot id of the playlist revision this backup was taken from */
    snapshotId: string;
    /** The full track order; null when only the metadata was captured */
    trackUris: string[] | null;
    /** Local files cannot be re-added by the API, so they are counted here */
    localTrackCount: number;
}

export interface ILibrarySnapshot {
    version: number;
    id: string;
    takenAt: number;
    reason: TSnapshotReason;
    /** Short human-readable label, e.g. the playlist name or "Full library" */
    label: string;
    userId: string | null;
    playlists: ISnapshotPlaylist[];
    tree: Record<string, ITreeNode>;
}

export interface IRestoreResult {
    restoredPlaylists: number;
    restoredTracks: number;
    skippedLocal: number;
    failed: { name: string; message: string }[];
}

export interface IRestorePreviewEntry {
    name: string;
    /** 'changed' when the live order differs, 'same' when it matches, 'missing' when gone */
    state: 'changed' | 'same' | 'missing';
    backupTrackCount: number;
    liveTrackCount: number | null;
}

/**
 * LibrarySnapshot captures, stores and replays the state of playlists.
 */
class LibrarySnapshot {
    /**
     * Builds a snapshot entry for one playlist, including its full track order.
     * @param playlist - The playlist to capture.
     * @returns The snapshot entry.
     */
    private static readonly capturePlaylistEntry = async (playlist: Playlist): Promise<ISnapshotPlaylist> => {
        const tracks = await SpotifyAPI.fetchPlaylistTracks(playlist.id);
        const localTrackCount = tracks.filter((track) => track.isLocal || track.uri.startsWith('spotify:local:')).length;

        return {
            id: playlist.id,
            name: playlist.name,
            description: playlist.description ?? '',
            isPublic: playlist.isPublic,
            isCollaborative: playlist.isCollaborative,
            ownerId: playlist.ownerId,
            isOwn: playlist.isOwn,
            snapshotId: playlist.snapshotId,
            trackUris: tracks.map((track) => track.uri),
            localTrackCount,
        };
    };

    /**
     * Builds a metadata-only entry (no track fetch), used for visibility
     * changes where the track order is not touched.
     * @param playlist - The playlist to capture.
     * @returns The snapshot entry without a track order.
     */
    private static readonly captureMetaEntry = (playlist: Playlist): ISnapshotPlaylist => {
        return {
            id: playlist.id,
            name: playlist.name,
            description: playlist.description ?? '',
            isPublic: playlist.isPublic,
            isCollaborative: playlist.isCollaborative,
            ownerId: playlist.ownerId,
            isOwn: playlist.isOwn,
            snapshotId: playlist.snapshotId,
            trackUris: null,
            localTrackCount: 0,
        };
    };

    /**
     * Captures a single playlist with its track order. Used right before any
     * write that changes the contents of that playlist.
     * @param playlist - The playlist to capture.
     * @param reason - What triggered the snapshot.
     * @param userId - The current user id.
     * @returns The stored snapshot.
     */
    public static readonly capturePlaylist = async (
        playlist: Playlist,
        reason: TSnapshotReason,
        userId: string | null,
    ): Promise<ILibrarySnapshot> => {
        const entry = await LibrarySnapshot.capturePlaylistEntry(playlist);
        return LibrarySnapshot.store({
            version: SNAPSHOT_VERSION,
            id: LibrarySnapshot.newId(),
            takenAt: Date.now(),
            reason,
            label: playlist.name,
            userId,
            playlists: [entry],
            tree: LibraryTree.exportNodes(),
        });
    };

    /**
     * Captures the metadata of several playlists without fetching tracks.
     * Used before mass visibility changes, which are cheap to reverse.
     * @param playlists - The playlists to capture.
     * @param reason - What triggered the snapshot.
     * @param userId - The current user id.
     * @param label - Human-readable label for the recovery list.
     * @returns The stored snapshot.
     */
    public static readonly captureMeta = (
        playlists: Playlist[],
        reason: TSnapshotReason,
        userId: string | null,
        label: string,
    ): ILibrarySnapshot => {
        return LibrarySnapshot.store({
            version: SNAPSHOT_VERSION,
            id: LibrarySnapshot.newId(),
            takenAt: Date.now(),
            reason,
            label,
            userId,
            playlists: playlists.map(LibrarySnapshot.captureMetaEntry),
            tree: LibraryTree.exportNodes(),
        });
    };

    /**
     * Captures the whole library including every track order. This costs one
     * request per 100 tracks per playlist, so it reports progress and is only
     * triggered manually.
     * @param playlists - All playlists of the library.
     * @param userId - The current user id.
     * @param onProgress - Called after each playlist with (done, total).
     * @returns The snapshot, not stored in localStorage (it is downloaded).
     */
    public static readonly captureLibrary = async (
        playlists: Playlist[],
        userId: string | null,
        onProgress?: (done: number, total: number) => void,
    ): Promise<ILibrarySnapshot> => {
        const entries: ISnapshotPlaylist[] = [];

        for (const playlist of playlists) {
            try {
                entries.push(await LibrarySnapshot.capturePlaylistEntry(playlist));
            } catch (e) {
                console.error(e);
                // A playlist that cannot be read is still worth keeping as metadata
                entries.push(LibrarySnapshot.captureMetaEntry(playlist));
            }
            onProgress?.(entries.length, playlists.length);
        }

        return {
            version: SNAPSHOT_VERSION,
            id: LibrarySnapshot.newId(),
            takenAt: Date.now(),
            reason: 'manual',
            label: 'Full library',
            userId,
            playlists: entries,
            tree: LibraryTree.exportNodes(),
        };
    };

    /**
     * Compares a snapshot against the live library so the user sees what a
     * restore would touch before confirming it.
     * @param snapshot - The snapshot to inspect.
     * @param livePlaylists - The playlists currently in the library.
     * @returns One preview entry per playlist in the snapshot.
     */
    public static readonly previewRestore = async (
        snapshot: ILibrarySnapshot,
        livePlaylists: Playlist[],
    ): Promise<IRestorePreviewEntry[]> => {
        const preview: IRestorePreviewEntry[] = [];

        for (const entry of snapshot.playlists) {
            const live = livePlaylists.find((playlist) => playlist.id === entry.id);
            if (!live) {
                preview.push({
                    name: entry.name,
                    state: 'missing',
                    backupTrackCount: entry.trackUris?.length ?? 0,
                    liveTrackCount: null,
                });
                continue;
            }

            if (entry.trackUris === null) {
                // Metadata-only entry: compare the visibility flag instead
                preview.push({
                    name: entry.name,
                    state: live.isPublic === entry.isPublic ? 'same' : 'changed',
                    backupTrackCount: 0,
                    liveTrackCount: live.trackCount,
                });
                continue;
            }

            try {
                const liveTracks = await SpotifyAPI.fetchPlaylistTracks(entry.id);
                const liveUris = liveTracks.map((track) => track.uri);
                const identical =
                    liveUris.length === entry.trackUris.length &&
                    liveUris.every((uri, index) => uri === entry.trackUris?.[index]);

                preview.push({
                    name: entry.name,
                    state: identical ? 'same' : 'changed',
                    backupTrackCount: entry.trackUris.length,
                    liveTrackCount: liveUris.length,
                });
            } catch (e) {
                console.error(e);
                preview.push({
                    name: entry.name,
                    state: 'changed',
                    backupTrackCount: entry.trackUris.length,
                    liveTrackCount: null,
                });
            }
        }

        return preview;
    };

    /**
     * Restores a snapshot back into Spotify.
     *
     * What is restored: the track order and contents of every playlist that
     * carries a track order, the public/private flag, and the virtual folder
     * tree.
     *
     * What cannot be restored: local files (the API refuses to re-add
     * spotify:local URIs), the original "added at" timestamps (restored
     * tracks count as added today), and playlists that no longer exist, which
     * have to come back through the Spotify account page first.
     *
     * A safety snapshot of the current state is taken before anything is
     * written, so a restore can itself be rolled back.
     *
     * @param snapshot - The snapshot to replay.
     * @param livePlaylists - The playlists currently in the library.
     * @param onProgress - Called after each playlist with (done, total).
     * @returns What was restored and what failed.
     */
    public static readonly restoreSnapshot = async (
        snapshot: ILibrarySnapshot,
        livePlaylists: Playlist[],
        onProgress?: (done: number, total: number) => void,
    ): Promise<IRestoreResult> => {
        const result: IRestoreResult = {
            restoredPlaylists: 0,
            restoredTracks: 0,
            skippedLocal: 0,
            failed: [],
        };

        // Safety net: the restore itself is a destructive write
        const affected = livePlaylists.filter((playlist) =>
            snapshot.playlists.some((entry) => entry.id === playlist.id && entry.trackUris !== null),
        );
        if (affected.length > 0) {
            try {
                const entries: ISnapshotPlaylist[] = [];
                for (const playlist of affected) {
                    entries.push(await LibrarySnapshot.capturePlaylistEntry(playlist));
                }
                LibrarySnapshot.store({
                    version: SNAPSHOT_VERSION,
                    id: LibrarySnapshot.newId(),
                    takenAt: Date.now(),
                    reason: 'pre-restore',
                    label: snapshot.label,
                    userId: snapshot.userId,
                    playlists: entries,
                    tree: LibraryTree.exportNodes(),
                });
            } catch (e) {
                console.error(e);
                // The safety snapshot is best effort, the restore still proceeds
            }
        }

        let done = 0;
        for (const entry of snapshot.playlists) {
            const live = livePlaylists.find((playlist) => playlist.id === entry.id);

            if (!live) {
                result.failed.push({ name: entry.name, message: 'not-in-library' });
                done += 1;
                onProgress?.(done, snapshot.playlists.length);
                continue;
            }

            if (!live.isOwn) {
                result.failed.push({ name: entry.name, message: 'not-owned' });
                done += 1;
                onProgress?.(done, snapshot.playlists.length);
                continue;
            }

            try {
                if (entry.trackUris !== null) {
                    const skipped = await SpotifyAPI.applyTrackOrder(entry.id, entry.trackUris);
                    result.skippedLocal += skipped;
                    result.restoredTracks += entry.trackUris.length - skipped;
                }

                if (entry.isPublic !== null && entry.isPublic !== live.isPublic) {
                    await SpotifyAPI.setPlaylistVisibility(entry.id, entry.isPublic);
                }

                result.restoredPlaylists += 1;
            } catch (e) {
                console.error(e);
                result.failed.push({
                    name: entry.name,
                    message: e instanceof Error ? e.message : String(e),
                });
            }

            done += 1;
            onProgress?.(done, snapshot.playlists.length);
        }

        // The folder tree is local, so it is restored regardless of API results
        LibraryTree.importNodes(snapshot.tree);

        return result;
    };

    /**
     * Stores a snapshot in the local ring buffer, dropping the oldest entries
     * once the limit is reached.
     * @param snapshot - The snapshot to store.
     * @returns The stored snapshot.
     */
    public static readonly store = (snapshot: ILibrarySnapshot): ILibrarySnapshot => {
        const existing = LibrarySnapshot.list();
        const next = [snapshot, ...existing].slice(0, MAX_SNAPSHOTS);

        try {
            StorageHandler.set(STORAGE_KEY, next);
        } catch (e) {
            console.error(e);
            // localStorage is full: keep only the newest few and retry once
            StorageHandler.set(STORAGE_KEY, next.slice(0, 5));
        }

        return snapshot;
    };

    /**
     * All stored snapshots, newest first.
     * @returns The snapshots.
     */
    public static readonly list = (): ILibrarySnapshot[] => {
        const stored = StorageHandler.get(STORAGE_KEY, []) as ILibrarySnapshot[];
        if (!Array.isArray(stored)) return [];
        return stored.filter((snapshot) => snapshot && snapshot.version === SNAPSHOT_VERSION);
    };

    /**
     * Looks up one stored snapshot.
     * @param id - The snapshot id.
     * @returns The snapshot or undefined.
     */
    public static readonly get = (id: string): ILibrarySnapshot | undefined => {
        return LibrarySnapshot.list().find((snapshot) => snapshot.id === id);
    };

    /**
     * Removes one stored snapshot.
     * @param id - The snapshot id.
     */
    public static readonly remove = (id: string): void => {
        StorageHandler.set(
            STORAGE_KEY,
            LibrarySnapshot.list().filter((snapshot) => snapshot.id !== id),
        );
    };

    /**
     * Removes every stored snapshot.
     */
    public static readonly clear = (): void => {
        StorageHandler.remove(STORAGE_KEY);
    };

    /**
     * Serializes a snapshot for download.
     * @param snapshot - The snapshot to serialize.
     * @returns The file name and the JSON payload.
     */
    public static readonly toFile = (snapshot: ILibrarySnapshot): { fileName: string; content: string } => {
        const date = new Date(snapshot.takenAt);
        const stamp = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0'),
            String(date.getHours()).padStart(2, '0'),
            String(date.getMinutes()).padStart(2, '0'),
        ];

        return {
            fileName: `spotify-library-backup-${stamp[0]}${stamp[1]}${stamp[2]}-${stamp[3]}${stamp[4]}.json`,
            content: JSON.stringify(snapshot, null, 2),
        };
    };

    /**
     * Parses and validates a snapshot file.
     * @param text - The file contents.
     * @returns The snapshot.
     * @throws If the file is not a snapshot of a supported version.
     */
    public static readonly fromFile = (text: string): ILibrarySnapshot => {
        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch {
            throw new Error('invalid-json');
        }

        const snapshot = parsed as ILibrarySnapshot;
        if (
            !snapshot ||
            typeof snapshot !== 'object' ||
            snapshot.version !== SNAPSHOT_VERSION ||
            !Array.isArray(snapshot.playlists) ||
            typeof snapshot.tree !== 'object' ||
            snapshot.tree === null
        ) {
            throw new Error('unsupported-file');
        }

        return snapshot;
    };

    /**
     * Generates a snapshot id.
     * @returns The id.
     */
    private static readonly newId = (): string => {
        return `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    };
}

export default LibrarySnapshot;
