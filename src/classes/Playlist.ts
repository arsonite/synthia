/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 */

// Classes
import { BaseEntity } from './BaseEntity';

export interface IPlaylistRaw {
    id: string;
    uri?: string;
    name: string;
    description?: string | null;
    collaborative?: boolean;
    public?: boolean | null;
    snapshot_id?: string;
    owner?: { id?: string; display_name?: string | null };
    tracks?: { total?: number };
    images?: { url: string }[] | null;
    external_urls?: { spotify?: string };
}

export class Playlist extends BaseEntity {
    public readonly id: string;
    public readonly uri: string;
    public readonly ownerId: string;
    public readonly ownerName: string;
    /** True if the current user owns the playlist and may therefore modify it */
    public readonly isOwn: boolean;
    /** Spotify may return null here for playlists it does not disclose */
    public readonly isPublic: boolean | null;
    public readonly isCollaborative: boolean;
    public readonly trackCount: number;
    public readonly imageUrl: string | null;
    public readonly snapshotId: string;
    public readonly externalUrl: string | null;

    constructor(raw: IPlaylistRaw, currentUserId: string | null) {
        super({
            name: raw.name,
            displayName: raw.name,
            description: raw.description ?? undefined,
        });

        this.id = raw.id;
        this.uri = raw.uri ?? `spotify:playlist:${raw.id}`;
        this.ownerId = raw.owner?.id ?? '';
        this.ownerName = raw.owner?.display_name || this.ownerId;
        this.isOwn = currentUserId !== null && this.ownerId === currentUserId;
        this.isPublic = raw.public ?? null;
        this.isCollaborative = raw.collaborative ?? false;
        this.trackCount = raw.tracks?.total ?? 0;
        this.imageUrl = raw.images && raw.images.length > 0 ? raw.images[0].url : null;
        this.snapshotId = raw.snapshot_id ?? '';
        this.externalUrl = raw.external_urls?.spotify ?? null;
    }
}
