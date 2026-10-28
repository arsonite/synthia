/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Track model. Release dates on Spotify are album properties with a precision
 * of 'year', 'month', or 'day'; the same recording often exists on several
 * releases (single, album, compilation, remaster) with different dates.
 * This class normalizes all of that for sorting and for the variant finder.
 */

export type TReleaseDatePrecision = 'year' | 'month' | 'day' | null;

export interface ITrackAlbumRaw {
    id?: string;
    name?: string;
    album_type?: string;
    release_date?: string;
    release_date_precision?: string;
    images?: { url: string; width?: number; height?: number }[];
}

export interface ITrackRaw {
    id?: string | null;
    uri?: string;
    name?: string;
    type?: string;
    is_local?: boolean;
    explicit?: boolean;
    duration_ms?: number;
    popularity?: number;
    artists?: { name: string }[];
    album?: ITrackAlbumRaw;
}

export interface IPlaylistItemRaw {
    added_at?: string | null;
    is_local?: boolean;
    track?: ITrackRaw | null;
}

export class Track {
    public readonly id: string | null;
    public readonly uri: string;
    public readonly name: string;
    public readonly artistNames: string[];
    public readonly artistLabel: string;
    public readonly albumId: string | null;
    public readonly albumName: string;
    public readonly albumType: string | null;
    public readonly albumImageUrl: string | null;
    public readonly releaseDate: string | null;
    public readonly releaseDatePrecision: TReleaseDatePrecision;
    public readonly durationMs: number;
    public readonly popularity: number | null;
    public readonly explicit: boolean;
    public readonly isLocal: boolean;
    public readonly addedAt: string | null;
    /** Original position inside the playlist (needed for exact replacements) */
    public readonly position: number;

    constructor(raw: ITrackRaw, position: number, addedAt: string | null = null, isLocalItem = false) {
        this.id = raw.id ?? null;
        this.uri = raw.uri ?? '';
        this.name = raw.name ?? '';
        this.artistNames = (raw.artists ?? []).map((artist) => artist.name);
        this.artistLabel = this.artistNames.join(', ');
        this.albumId = raw.album?.id ?? null;
        this.albumName = raw.album?.name ?? '';
        this.albumType = raw.album?.album_type ?? null;
        this.albumImageUrl = Track.smallestImage(raw.album?.images);
        this.releaseDate = raw.album?.release_date ?? null;
        this.releaseDatePrecision = (raw.album?.release_date_precision as TReleaseDatePrecision) ?? null;
        this.durationMs = raw.duration_ms ?? 0;
        this.popularity = raw.popularity ?? null;
        this.explicit = raw.explicit ?? false;
        this.isLocal = isLocalItem || (raw.is_local ?? false);
        this.addedAt = addedAt;
        this.position = position;
    }

    /**
     * Builds a Track from a playlist item as returned by the API.
     * Episodes are filtered out by the caller.
     * @param item - The raw playlist item.
     * @param position - The item's position in the playlist.
     * @returns The Track instance.
     */
    public static readonly fromPlaylistItem = (item: IPlaylistItemRaw, position: number): Track => {
        return new Track(item.track ?? {}, position, item.added_at ?? null, item.is_local ?? false);
    };

    /**
     * Picks the smallest image of an album image set (row thumbnails).
     * @param images - The album images, widest first.
     * @returns The smallest image URL or null.
     */
    private static readonly smallestImage = (images?: { url: string }[]): string | null => {
        if (!images || images.length === 0) return null;
        return images[images.length - 1].url;
    };

    /**
     * The release date formatted according to its precision
     * (dd.mm.yyyy / mm.yyyy / yyyy).
     */
    public get releaseDateLabel(): string {
        if (!this.releaseDate) return '?';
        const parts = this.releaseDate.split('-');
        if (this.releaseDatePrecision === 'day' && parts.length === 3) {
            return `${parts[2]}.${parts[1]}.${parts[0]}`;
        }
        if (this.releaseDatePrecision === 'month' && parts.length >= 2) {
            return `${parts[1]}.${parts[0]}`;
        }
        return parts[0];
    }

    /**
     * The release date as a sortable timestamp. Unknown dates yield null and
     * are sorted to the end by the sort strategies.
     */
    public get releaseTimestamp(): number | null {
        if (!this.releaseDate) return null;
        const timestamp = Date.parse(this.releaseDate);
        return Number.isNaN(timestamp) ? null : timestamp;
    }

    /**
     * The duration formatted as m:ss.
     */
    public get durationLabel(): string {
        const totalSeconds = Math.round(this.durationMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }

    /**
     * The date the track was added to the playlist, formatted as dd.mm.yyyy.
     */
    public get addedAtLabel(): string {
        if (!this.addedAt) return '';
        const date = new Date(this.addedAt);
        if (Number.isNaN(date.getTime())) return '';
        return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
    }
}
