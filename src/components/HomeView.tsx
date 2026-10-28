/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Home view: library stats, the Discover Weekly archive button, the API
 * limitation notes and the application settings.
 */

// React imports
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

// Components
import BackupPanel from '@/components/Backup/BackupPanel';
import Icon from '@/components/Icon';
import IconButton from '@/components/IconButton';

// Context
import { useGlobalContext } from '@/withGlobalContext';

// API
import SpotifyAuth from '@/api/SpotifyAuth';

// Features
import { archiveDiscoverWeekly } from '@/features/discoverWeekly';

// Utility
import Config from '@/config';
import LibraryTree from '@/util/LibraryTree';
import StorageHandler from '@/util/StorageHandler';
import i18n from '@/util/i18n';

// Types
import { tTranslationFunction } from '@/util/i18n.types';

// Style
import './_style/HomeView.scss';

interface IHomeViewProps {
    refreshPlaylists: () => Promise<void>;
}

interface IHomeViewState {
    archiving: boolean;
    dwSourceId: string;
    wsUrl: string;
}

const HomeView: React.FC<IHomeViewProps> = (props) => {
    // Translation
    const { t } = useTranslation('app', { keyPrefix: 'home' });

    const [searchParams, setSearchParams] = useSearchParams();

    // Context
    const {
        user: [user],
        playlists: [playlists],
        treeVersion: [treeVersion, setTreeVersion],
    } = useGlobalContext();

    // State
    const [archiving, setArchiving] = useState<IHomeViewState['archiving']>(false);
    const [dwSourceId, setDwSourceId] = useState<IHomeViewState['dwSourceId']>(
        (StorageHandler.get('settings.spotify.dwSourceId', '') as string) ?? '',
    );
    const [wsUrl, setWsUrl] = useState<IHomeViewState['wsUrl']>(
        (StorageHandler.get('settings.chat.wsUrl', Config.chat.defaultWebSocketURL) as string) ??
            Config.chat.defaultWebSocketURL,
    );

    // Variables
    const ownCount = playlists.filter((playlist) => playlist.isOwn).length;
    const publicCount = playlists.filter((playlist) => playlist.isPublic === true).length;
    const folderCount = LibraryTree.foldersWithDepth().length;
    void treeVersion; // Recompute the folder count whenever the tree changes

    // Handler functions
    const handleArchive = async () => {
        if (!user || archiving) return;
        setArchiving(true);

        try {
            const result = await archiveDiscoverWeekly(t as tTranslationFunction, user, playlists);
            setTreeVersion((version) => version + 1);

            if (result.created) {
                toast.success(t('dw.archived', { name: result.playlistName, count: result.trackCount }));
                await props.refreshPlaylists();
            } else {
                toast(t('dw.already-archived', { name: result.playlistName }));
            }
        } catch (e) {
            console.error(e);
            toast.error(e instanceof Error ? e.message : t('dw.failed'));
        } finally {
            setArchiving(false);
        }
    };

    // The sidebar shortcut navigates here with ?archive=1 and triggers the archiver once
    const archiveTriggeredRef = useRef(false);
    useEffect(() => {
        if (searchParams.get('archive') !== '1' || archiveTriggeredRef.current || !user) return;
        archiveTriggeredRef.current = true;
        setSearchParams({}, { replace: true });
        handleArchive();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, user]);

    const handleLanguageChange = (language: string) => {
        StorageHandler.set('settings.ui.language', language);
        i18n.changeLanguage(language);
    };

    return (
        <div id='home-view'>
            <header id='home-header'>
                {user?.imageUrl ? (
                    <img id='home-avatar' src={user.imageUrl} alt='' />
                ) : (
                    <div id='home-avatar' className='placeholder'>
                        <Icon name='user' size={28} />
                    </div>
                )}
                <div>
                    <h1>{t('welcome', { name: user?.displayName ?? '' })}</h1>
                    <p id='home-subtitle'>{t('subtitle')}</p>
                </div>
            </header>

            <section id='home-stats'>
                <div className='stat-card'>
                    <span className='stat-value'>{playlists.length}</span>
                    <span className='stat-label'>{t('stats.playlists')}</span>
                </div>
                <div className='stat-card'>
                    <span className='stat-value'>{ownCount}</span>
                    <span className='stat-label'>{t('stats.own')}</span>
                </div>
                <div className='stat-card'>
                    <span className='stat-value'>{publicCount}</span>
                    <span className='stat-label'>{t('stats.public')}</span>
                </div>
                <div className='stat-card'>
                    <span className='stat-value'>{folderCount}</span>
                    <span className='stat-label'>{t('stats.folders')}</span>
                </div>
            </section>

            <section className='home-card' id='home-dw'>
                <div className='home-card-text'>
                    <h2>
                        <Icon name='calendar' size={18} /> {t('dw.title')}
                    </h2>
                    <p>{t('dw.description-text', { folder: Config.discoverWeekly.folderName })}</p>
                </div>
                <IconButton filled disabled={archiving || !user} icon='calendar' theme='green' onClick={handleArchive}>
                    {archiving ? t('dw.archiving') : t('dw.button')}
                </IconButton>
            </section>

            <section className='home-card' id='home-limitations'>
                <h2>
                    <Icon name='warning' size={18} /> {t('limitations.title')}
                </h2>
                <p>{t('limitations.folders')}</p>
                <p>{t('limitations.dw')}</p>
            </section>

            <BackupPanel refreshPlaylists={props.refreshPlaylists} />

            <section className='home-card' id='home-settings'>
                <h2>
                    <Icon name='sliders' size={18} /> {t('settings.title')}
                </h2>

                <div className='setting-row'>
                    <label htmlFor='setting-language'>{t('settings.language')}</label>
                    <select
                        id='setting-language'
                        value={i18n.language}
                        onChange={(e) => handleLanguageChange(e.target.value)}
                    >
                        <option value='en'>English</option>
                        <option value='de'>Deutsch</option>
                    </select>
                </div>

                <div className='setting-row'>
                    <label htmlFor='setting-dw-source'>{t('settings.dw-source')}</label>
                    <input
                        id='setting-dw-source'
                        type='text'
                        spellCheck={false}
                        placeholder={t('settings.dw-source-placeholder')}
                        value={dwSourceId}
                        onChange={(e) => {
                            setDwSourceId(e.target.value);
                            StorageHandler.set('settings.spotify.dwSourceId', e.target.value.trim());
                        }}
                    />
                </div>
                <p className='setting-hint'>{t('settings.dw-source-hint')}</p>

                <div className='setting-row'>
                    <label htmlFor='setting-ws-url'>{t('settings.ws-url')}</label>
                    <input
                        id='setting-ws-url'
                        type='text'
                        spellCheck={false}
                        value={wsUrl}
                        onChange={(e) => {
                            setWsUrl(e.target.value);
                            StorageHandler.set('settings.chat.wsUrl', e.target.value.trim());
                        }}
                    />
                </div>

                <div className='setting-row'>
                    <label>{t('settings.account')}</label>
                    <IconButton
                        icon='logout'
                        size='small'
                        theme='red'
                        onClick={() => {
                            SpotifyAuth.logout();
                            window.location.assign('/login');
                        }}
                    >
                        {t('settings.logout')}
                    </IconButton>
                </div>
            </section>
        </div>
    );
};

export default HomeView;
