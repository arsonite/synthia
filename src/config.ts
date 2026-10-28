/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Central configuration. Everything that is deployment- or account-specific
 * lives here or in StorageHandler-backed settings, never inside components.
 */

const Config = {
    spotify: {
        accountsBaseURL: 'https://accounts.spotify.com',
        apiBaseURL: 'https://api.spotify.com/v1',
        // The redirect URI is derived from the current origin so dev and preview
        // builds work as long as the origin is registered in the Spotify dashboard.
        redirectPath: '/callback',
        scopes: [
            'playlist-read-private',
            'playlist-read-collaborative',
            'playlist-modify-public',
            'playlist-modify-private',
            'user-read-private',
        ],
    },
    discoverWeekly: {
        folderName: 'Weekly Mix',
        sourcePlaylistName: 'Discover Weekly',
    },
    chat: {
        defaultWebSocketURL: 'ws://127.0.0.1:8765',
        protocolVersion: 1,
    },
} as const;

export default Config;
