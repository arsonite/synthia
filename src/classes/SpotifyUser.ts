/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 */

export interface ISpotifyUserRaw {
    id: string;
    display_name?: string | null;
    product?: string;
    images?: { url: string }[];
}

export class SpotifyUser {
    public readonly id: string;
    public readonly displayName: string;
    public readonly product: string | null;
    public readonly imageUrl: string | null;

    constructor(raw: ISpotifyUserRaw) {
        this.id = raw.id;
        this.displayName = raw.display_name || raw.id;
        this.product = raw.product ?? null;
        this.imageUrl = raw.images && raw.images.length > 0 ? raw.images[0].url : null;
    }
}
