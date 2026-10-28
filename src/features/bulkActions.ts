/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Bulk action registry for the selection toolbar. Add a new entry here and
 * it automatically appears when playlists are selected.
 */

// React imports
import { toast } from 'react-hot-toast';

// Classes
import { Playlist } from '@/classes/Playlist';

// API
import SpotifyAPI from '@/api/SpotifyAPI';

// Utility
import LibrarySnapshot from '@/util/LibrarySnapshot';

// Types
import { TIconName } from '@/components/Icon';
import { tTranslationFunction } from '@/util/i18n.types';

export interface IBulkActionContext {
    t: tTranslationFunction;
    refreshPlaylists: () => Promise<void>;
    openFolderPicker: () => void;
    clearSelection: () => void;
}

export interface IBulkAction {
    id: string;
    /** i18n key inside the 'toolbar' group */
    labelKey: string;
    icon: TIconName;
    theme?: 'green' | 'gray' | 'red' | 'blue';
    run: (selected: Playlist[], ctx: IBulkActionContext) => Promise<void>;
}

/**
 * Sets the visibility of every owned playlist in the selection.
 * Playlists owned by other users are skipped, since the API rejects them.
 */
const setVisibility = async (selected: Playlist[], ctx: IBulkActionContext, isPublic: boolean): Promise<void> => {
    const own = selected.filter((playlist) => playlist.isOwn);
    const skipped = selected.length - own.length;

    // Metadata-only backup, the track orders are not touched here
    if (own.length > 0) {
        LibrarySnapshot.captureMeta(
            own,
            'visibility',
            own[0].ownerId,
            ctx.t('toolbar.visibility-backup-label', { count: own.length }),
        );
    }

    let changed = 0;
    for (const playlist of own) {
        try {
            await SpotifyAPI.setPlaylistVisibility(playlist.id, isPublic);
            changed += 1;
        } catch (e) {
            console.error(e);
            toast.error(ctx.t('toolbar.visibility-failed', { name: playlist.name }));
        }
    }

    if (changed > 0) {
        toast.success(
            isPublic
                ? ctx.t('toolbar.made-public', { count: changed })
                : ctx.t('toolbar.made-private', { count: changed }),
        );
    }
    if (skipped > 0) {
        toast(ctx.t('toolbar.skipped-not-owned', { count: skipped }));
    }

    ctx.clearSelection();
    await ctx.refreshPlaylists();
};

export const bulkActions: IBulkAction[] = [
    {
        id: 'make-public',
        labelKey: 'make-public',
        icon: 'globe',
        theme: 'green',
        run: (selected, ctx) => setVisibility(selected, ctx, true),
    },
    {
        id: 'make-private',
        labelKey: 'make-private',
        icon: 'lock',
        theme: 'gray',
        run: (selected, ctx) => setVisibility(selected, ctx, false),
    },
    {
        id: 'move-to-folder',
        labelKey: 'move-to-folder',
        icon: 'move',
        theme: 'blue',
        run: async (selected, ctx) => {
            if (selected.length === 0) return;
            // The folder picker takes over; the actual move happens on pick
            ctx.openFolderPicker();
        },
    },
];
