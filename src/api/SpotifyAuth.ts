/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Authorization Code flow with PKCE. Spotify removed the implicit grant and
 * requires PKCE for client-side apps; refresh tokens rotate on every refresh.
 */

// Utility
import StorageHandler from '@/util/StorageHandler';

// Config
import Config from '@/config';

interface ITokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
    scope?: string;
}

class SpotifyAuth {
    private static refreshPromise: Promise<void> | null = null;

    /**
     * Resolves the client ID from the environment or from the stored settings
     * (the login view lets the user paste it once).
     * @returns The client ID or null if not configured.
     */
    public static readonly getClientId = (): string | null => {
        const fromEnv = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
        if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();
        const fromSettings = StorageHandler.get('settings.spotify.clientId', null) as string | null;
        return fromSettings && fromSettings.trim().length > 0 ? fromSettings.trim() : null;
    };

    /**
     * Stores the client ID pasted in the login view.
     * @param clientId - The Spotify app client ID.
     */
    public static readonly setClientId = (clientId: string): void => {
        StorageHandler.set('settings.spotify.clientId', clientId.trim());
    };

    /**
     * The redirect URI derived from the current origin. Must be registered
     * verbatim in the Spotify dashboard (http://127.0.0.1:5173/callback).
     * @returns The redirect URI.
     */
    public static readonly getRedirectUri = (): string => {
        return `${window.location.origin}${Config.spotify.redirectPath}`;
    };

    /**
     * Whether a session exists (an access or refresh token is stored).
     * @returns True if authenticated.
     */
    public static readonly isAuthenticated = (): boolean => {
        return (
            StorageHandler.get('auth.accessToken', null) !== null ||
            StorageHandler.get('auth.refreshToken', null) !== null
        );
    };

    /**
     * Starts the login flow: generates the PKCE verifier/challenge and
     * redirects the browser to the Spotify consent page.
     */
    public static readonly login = async (): Promise<void> => {
        const clientId = SpotifyAuth.getClientId();
        if (!clientId) throw new Error('missing-client-id');

        const verifier = SpotifyAuth.generateRandomString(64);
        const challenge = SpotifyAuth.base64UrlEncode(await SpotifyAuth.sha256(verifier));
        StorageHandler.Session.set('auth.codeVerifier', verifier);

        const params = new URLSearchParams({
            client_id: clientId,
            response_type: 'code',
            redirect_uri: SpotifyAuth.getRedirectUri(),
            scope: Config.spotify.scopes.join(' '),
            code_challenge_method: 'S256',
            code_challenge: challenge,
        });

        window.location.href = `${Config.spotify.accountsBaseURL}/authorize?${params.toString()}`;
    };

    /**
     * Exchanges the authorization code from the callback for tokens.
     * @param code - The authorization code from the redirect.
     */
    public static readonly handleCallback = async (code: string): Promise<void> => {
        const clientId = SpotifyAuth.getClientId();
        const verifier = StorageHandler.Session.get('auth.codeVerifier', null) as string | null;
        if (!clientId || !verifier) throw new Error('missing-verifier');

        const response = await fetch(`${Config.spotify.accountsBaseURL}/api/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                grant_type: 'authorization_code',
                code,
                redirect_uri: SpotifyAuth.getRedirectUri(),
                code_verifier: verifier,
            }),
        });
        if (!response.ok) throw new Error(`token-exchange-failed (${response.status})`);

        SpotifyAuth.storeTokens((await response.json()) as ITokenResponse);
        StorageHandler.Session.remove('auth.codeVerifier');
    };

    /**
     * Returns a valid access token, refreshing it beforehand if it expires
     * within the next minute. Throws if no session exists.
     * @returns The access token.
     */
    public static readonly getValidAccessToken = async (): Promise<string> => {
        const expiresAt = (StorageHandler.get('auth.expiresAt', 0) as number) ?? 0;
        if (Date.now() > expiresAt - 60_000) {
            await SpotifyAuth.refresh();
        }
        const token = StorageHandler.get('auth.accessToken', null) as string | null;
        if (!token) throw new Error('not-authenticated');
        return token;
    };

    /**
     * Refreshes the access token via the (rotating) refresh token.
     * Concurrent calls are deduplicated into a single request.
     */
    public static readonly refresh = async (): Promise<void> => {
        if (SpotifyAuth.refreshPromise) return SpotifyAuth.refreshPromise;

        SpotifyAuth.refreshPromise = (async () => {
            const clientId = SpotifyAuth.getClientId();
            const refreshToken = StorageHandler.get('auth.refreshToken', null) as string | null;
            if (!clientId || !refreshToken) {
                SpotifyAuth.logout();
                throw new Error('not-authenticated');
            }

            const response = await fetch(`${Config.spotify.accountsBaseURL}/api/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: clientId,
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                }),
            });
            if (!response.ok) {
                SpotifyAuth.logout();
                throw new Error(`refresh-failed (${response.status})`);
            }

            SpotifyAuth.storeTokens((await response.json()) as ITokenResponse);
        })().finally(() => {
            SpotifyAuth.refreshPromise = null;
        });

        return SpotifyAuth.refreshPromise;
    };

    /**
     * Clears the session.
     */
    public static readonly logout = (): void => {
        StorageHandler.remove('auth');
    };

    /**
     * Persists a token response.
     * @param tokens - The token response from the accounts service.
     */
    private static readonly storeTokens = (tokens: ITokenResponse): void => {
        StorageHandler.set('auth.accessToken', tokens.access_token);
        StorageHandler.set('auth.expiresAt', Date.now() + tokens.expires_in * 1000);
        if (tokens.refresh_token) {
            StorageHandler.set('auth.refreshToken', tokens.refresh_token);
        }
    };

    /**
     * Generates a cryptographically random string for the PKCE verifier.
     * @param length - The string length.
     * @returns The random string.
     */
    private static readonly generateRandomString = (length: number): string => {
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const values = crypto.getRandomValues(new Uint8Array(length));
        return Array.from(values)
            .map((value) => possible[value % possible.length])
            .join('');
    };

    /**
     * Computes the SHA-256 digest of a string.
     * @param plain - The input string.
     * @returns The digest.
     */
    private static readonly sha256 = async (plain: string): Promise<ArrayBuffer> => {
        return crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
    };

    /**
     * Base64-URL-encodes a buffer (PKCE challenge format).
     * @param buffer - The buffer to encode.
     * @returns The encoded string.
     */
    private static readonly base64UrlEncode = (buffer: ArrayBuffer): string => {
        return btoa(String.fromCharCode(...new Uint8Array(buffer)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    };
}

export default SpotifyAuth;
