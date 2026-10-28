/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Application shell. Guards the routes behind the Spotify session, loads the
 * library once and hosts the sidebar, the content routes, the chat panel and
 * the selection toolbar.
 */

// React imports
import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

// Components
import CallbackView from '@/components/CallbackView';
import ChatPanel from '@/components/Chat/ChatPanel';
import HomeView from '@/components/HomeView';
import IconButton from '@/components/IconButton';
import LoginView from '@/components/LoginView';
import PlaylistView from '@/components/PlaylistView/PlaylistView';
import Sidebar from '@/components/Sidebar/Sidebar';
import SelectionToolbar from '@/components/Toolbar/SelectionToolbar';

// Context
import { useGlobalContext, withGlobalContext } from '@/withGlobalContext';

// API
import SpotifyAPI from '@/api/SpotifyAPI';
import SpotifyAuth from '@/api/SpotifyAuth';

// Utility
import LibraryTree from '@/util/LibraryTree';

// Style
import './Client.scss';

interface IClientState {
    libraryLoaded: boolean;
}

const Client: React.FC = () => {
    // Translation
    const { t } = useTranslation('app', { keyPrefix: 'client' });

    const location = useLocation();
    const navigate = useNavigate();

    // Context
    const {
        user: [user, setUser],
        playlists: [, setPlaylists],
        playlistsLoading: [, setPlaylistsLoading],
        treeVersion: [, setTreeVersion],
        chatOpen: [chatOpen, setChatOpen],
    } = useGlobalContext();

    // State
    const [libraryLoaded, setLibraryLoaded] = useState<IClientState['libraryLoaded']>(false);

    // Refs
    // WARNING: StrictMode mounts twice, the library may only be loaded once
    const loadStartedRef = useRef(false);

    // Variables
    const isAuthenticated = SpotifyAuth.isAuthenticated();
    const isCallback = location.pathname.startsWith('/callback');
    const isLogin = location.pathname.startsWith('/login');

    // Handler functions
    /**
     * Reloads the playlists and syncs them into the virtual tree.
     */
    const refreshPlaylists = useCallback(async () => {
        setPlaylistsLoading(true);
        try {
            const currentUser = user ?? (await SpotifyAPI.fetchCurrentUser());
            if (!user) setUser(currentUser);

            const playlists = await SpotifyAPI.fetchMyPlaylists(currentUser.id);
            setPlaylists(playlists);

            // New or removed playlists are reflected in the virtual tree
            if (LibraryTree.syncPlaylists(playlists)) {
                setTreeVersion((version) => version + 1);
            }
        } catch (e) {
            console.error(e);
            toast.error(t('library-failed'));
        } finally {
            setPlaylistsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    useEffect(() => {
        if (!isAuthenticated) {
            if (!isCallback && !isLogin) navigate('/login', { replace: true });
            return;
        }
        if (loadStartedRef.current) return;
        loadStartedRef.current = true;

        refreshPlaylists().finally(() => setLibraryLoaded(true));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, isCallback, isLogin]);

    // The login and callback views render without the application shell
    if (isCallback || isLogin || !isAuthenticated) {
        return (
            <Routes>
                <Route path='/login' element={<LoginView />} />
                <Route path='/callback' element={<CallbackView />} />
                <Route path='*' element={<Navigate replace to='/login' />} />
            </Routes>
        );
    }

    return (
        <div id='client'>
            <Sidebar
                refreshPlaylists={refreshPlaylists}
                onArchiveDiscoverWeekly={() => navigate('/?archive=1')}
            />

            <main id='content'>
                <Routes>
                    <Route path='/' element={<HomeView refreshPlaylists={refreshPlaylists} />} />
                    <Route path='/playlist/:id' element={<PlaylistView />} />
                    <Route path='*' element={<Navigate replace to='/' />} />
                </Routes>
            </main>

            <ChatPanel />
            <SelectionToolbar refreshPlaylists={refreshPlaylists} />

            {!chatOpen && (
                <IconButton
                    filled
                    icon='chat'
                    id='chat-toggle'
                    theme='blue'
                    title={t('open-chat')}
                    onClick={() => setChatOpen(true)}
                />
            )}

            {!libraryLoaded && <div id='client-loading'>{t('loading-library')}</div>}
        </div>
    );
};

export default withGlobalContext(Client);
