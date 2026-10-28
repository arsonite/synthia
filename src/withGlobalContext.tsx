/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Global application context. Holds the authenticated user, the playlist
 * library, the sidebar selection and the chat state.
 */

// React imports
import React from 'react';

// Components
import createContextProvider from '@/components/AbstractProvider';

// Classes
import { Playlist } from '@/classes/Playlist';
import { SpotifyUser } from '@/classes/SpotifyUser';

// API
import { IChatAttachment, IChatMessage, TChatStatus } from '@/api/LLMSocket';

export type TGlobalData = {
    // Library
    user: SpotifyUser | null;
    playlists: Playlist[];
    playlistsLoading: boolean;
    /** Bumped whenever LibraryTree changes, forces tree consumers to rerender */
    treeVersion: number;

    // Selection and mass actions
    selectedPlaylistIds: string[];
    folderPickerOpen: boolean;

    // Chat
    chatOpen: boolean;
    chatStatus: TChatStatus;
    chatMessages: IChatMessage[];
    chatAttachments: IChatAttachment[];
};

const initialValues: TGlobalData = {
    user: null,
    playlists: [],
    playlistsLoading: true,
    treeVersion: 0,

    selectedPlaylistIds: [],
    folderPickerOpen: false,

    chatOpen: false,
    chatStatus: 'disconnected',
    chatMessages: [],
    chatAttachments: [],
};

/**
 * Creates a context provider and hook for the global state, use aliases for ease of use.
 */
const { Provider: GlobalProvider, useCustomContext: useGlobalContext } =
    createContextProvider<TGlobalData>(initialValues);

/**
 * Higher-Order Component that wraps a component with the global context.
 *
 * @param WrappedComponent - The component to be wrapped with context.
 * @returns A new component wrapped with GlobalProvider.
 */
const withGlobalContext = <P extends object>(WrappedComponent: React.ComponentType<P>): React.FC<P> => {
    // Define the Higher-Order Component
    const HOC: React.FC<P> = (props) => (
        // Wrap the incoming component with GlobalProvider to provide context
        <GlobalProvider>
            <WrappedComponent {...props} />
        </GlobalProvider>
    );

    const wrappedComponentName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
    HOC.displayName = `withGlobalContext(${wrappedComponentName})`;

    return HOC;
};

export { withGlobalContext, useGlobalContext };
