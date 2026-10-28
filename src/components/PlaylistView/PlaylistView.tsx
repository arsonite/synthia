/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Playlist view. Lists all tracks with their release dates, offers the sort
 * strategy registry (including release date), can write a sorted order back
 * to Spotify and opens the variants panel for release-date correction.
 */

// React imports
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

// Components
import Icon from '@/components/Icon';
import IconButton from '@/components/IconButton';
import PopUp from '@/components/PopUp';
import TrackVariantsPanel from './TrackVariantsPanel';

// Classes
import { Playlist } from '@/classes/Playlist';
import { Track } from '@/classes/Track';

// Context
import { useGlobalContext } from '@/withGlobalContext';

// API
import SpotifyAPI from '@/api/SpotifyAPI';

// Features
import { sortStrategies, sortTracks } from '@/features/sortStrategies';

// Utility
import LibrarySnapshot from '@/util/LibrarySnapshot';
import { setDragEntity } from '@/util/DragPayload';

// Style
import './_style/PlaylistView.scss';

interface IPlaylistViewState {
    applyingOrder: boolean;
    ascending: boolean;
    confirmApplyOrder: boolean;
    playlist: Playlist | null;
    selectedTrack: Track | null;
    sortStrategyId: string;
    tracks: Track[] | null;
    tracksLoading: boolean;
}

const PlaylistView: React.FC = () => {
    // Translation
    const { t } = useTranslation('app', { keyPrefix: 'playlist' });

    const { id } = useParams();

    // Context
    const {
        user: [user],
        playlists: [playlists],
    } = useGlobalContext();

    // State
    const [applyingOrder, setApplyingOrder] = useState<IPlaylistViewState['applyingOrder']>(false);
    const [ascending, setAscending] = useState<IPlaylistViewState['ascending']>(true);
    const [confirmApplyOrder, setConfirmApplyOrder] = useState<IPlaylistViewState['confirmApplyOrder']>(false);
    const [playlist, setPlaylist] = useState<IPlaylistViewState['playlist']>(null);
    const [selectedTrack, setSelectedTrack] = useState<IPlaylistViewState['selectedTrack']>(null);
    const [sortStrategyId, setSortStrategyId] = useState<IPlaylistViewState['sortStrategyId']>('custom');
    const [tracks, setTracks] = useState<IPlaylistViewState['tracks']>(null);
    const [tracksLoading, setTracksLoading] = useState<IPlaylistViewState['tracksLoading']>(true);

    // Variables
    const sortedTracks = useMemo(
        () => (tracks ? sortTracks(tracks, sortStrategyId, ascending) : []),
        [tracks, sortStrategyId, ascending],
    );
    const isCustomOrder = sortStrategyId === 'custom' && ascending;

    // Handler functions
    const loadTracks = useCallback(
        async (playlistId: string) => {
            setTracksLoading(true);
            setSelectedTrack(null);
            try {
                const loaded = await SpotifyAPI.fetchPlaylistTracks(playlistId);
                setTracks(loaded);
            } catch (e) {
                console.error(e);
                setTracks([]);
                toast.error(t('load-failed'));
            } finally {
                setTracksLoading(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    useEffect(() => {
        if (!id) return;
        setSortStrategyId('custom');
        setAscending(true);

        // Prefer the already loaded library entry, fall back to a direct fetch
        const fromLibrary = playlists.find((candidate) => candidate.id === id) ?? null;
        if (fromLibrary) {
            setPlaylist(fromLibrary);
        } else {
            SpotifyAPI.fetchPlaylist(id, user?.id ?? null)
                .then(setPlaylist)
                .catch((e) => {
                    console.error(e);
                    setPlaylist(null);
                    toast.error(t('load-failed'));
                });
        }

        loadTracks(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, playlists]);

    const handleApplyOrder = async (choice: boolean) => {
        setConfirmApplyOrder(false);
        if (!choice || !playlist || sortedTracks.length === 0) return;

        setApplyingOrder(true);
        try {
            // Back up the current order first, the write below replaces the
            // playlist contents and cannot be undone through the API
            await LibrarySnapshot.capturePlaylist(playlist, 'order-write', user?.id ?? null);

            const skipped = await SpotifyAPI.applyTrackOrder(
                playlist.id,
                sortedTracks.map((track) => track.uri),
            );
            toast.success(t('order-applied-with-backup'));
            if (skipped > 0) toast(t('order-skipped-local', { count: skipped }));
            setSortStrategyId('custom');
            setAscending(true);
            await loadTracks(playlist.id);
        } catch (e) {
            console.error(e);
            // The playlist may be half written at this point, so point the
            // user at the backup that was just taken
            toast.error(t('order-failed-restorable'), { duration: 12000 });
        } finally {
            setApplyingOrder(false);
        }
    };

    const handleTrackDragStart = (e: React.DragEvent, track: Track) => {
        setDragEntity(e, {
            kind: 'track',
            id: track.id ?? track.uri,
            name: track.name,
            subtitle: track.artistLabel,
            meta: {
                uri: track.uri,
                artists: track.artistNames,
                album: track.albumName,
                albumType: track.albumType,
                releaseDate: track.releaseDate,
                releaseDatePrecision: track.releaseDatePrecision,
                durationMs: track.durationMs,
                popularity: track.popularity,
                explicit: track.explicit,
            },
        });
    };

    if (!id) return null;

    return (
        <div id='playlist-view'>
            <PopUp
                show={confirmApplyOrder}
                type='confirmation'
                warning
                header={t('apply-order-header')}
                body={<p>{t('apply-order-body', { name: playlist?.name ?? '' })}</p>}
                handleChoice={handleApplyOrder}
            />

            <header id='playlist-header'>
                {playlist?.imageUrl ? (
                    <img id='playlist-cover' src={playlist.imageUrl} alt='' />
                ) : (
                    <div id='playlist-cover' className='placeholder'>
                        <Icon name='playlist' size={32} />
                    </div>
                )}

                <div id='playlist-meta'>
                    <h1>{playlist?.name ?? ''}</h1>
                    <p id='playlist-subline'>
                        {playlist && (
                            <>
                                <span className={`visibility-badge ${playlist.isPublic ? 'public' : 'private'}`}>
                                    <Icon name={playlist.isPublic ? 'globe' : 'lock'} size={11} />
                                    {playlist.isPublic ? t('public') : t('private')}
                                </span>
                                <span>{t('by-owner', { owner: playlist.ownerName })}</span>
                                <span>{t('track-count', { count: tracks?.length ?? playlist.trackCount })}</span>
                            </>
                        )}
                    </p>
                    {playlist?.description && <p id='playlist-description'>{playlist.description}</p>}
                </div>

                <div id='playlist-actions'>
                    <div id='playlist-sort'>
                        <Icon name='sort' size={14} />
                        <select value={sortStrategyId} onChange={(e) => setSortStrategyId(e.target.value)}>
                            {sortStrategies.map((strategy) => (
                                <option key={strategy.id} value={strategy.id}>
                                    {t(`sort.${strategy.labelKey}`)}
                                </option>
                            ))}
                        </select>
                        <IconButton
                            hideBorder
                            icon={ascending ? 'arrow-up' : 'arrow-down'}
                            size='small'
                            theme='ghost'
                            title={t('toggle-direction')}
                            onClick={() => setAscending((current) => !current)}
                        />
                    </div>

                    {playlist?.isOwn && !isCustomOrder && (
                        <IconButton
                            filled
                            disabled={applyingOrder || tracksLoading}
                            icon='check'
                            size='small'
                            theme='green'
                            title={t('apply-order-tooltip')}
                            onClick={() => setConfirmApplyOrder(true)}
                        >
                            {applyingOrder ? t('applying-order') : t('apply-order')}
                        </IconButton>
                    )}

                    <IconButton
                        hideBorder
                        icon='refresh'
                        size='small'
                        theme='ghost'
                        title={t('refresh')}
                        onClick={() => loadTracks(id)}
                    />
                    {playlist?.externalUrl && (
                        <IconButton
                            hideBorder
                            icon='external'
                            size='small'
                            theme='ghost'
                            title={t('open-in-spotify')}
                            onClick={() => window.open(playlist.externalUrl as string, '_blank')}
                        />
                    )}
                </div>
            </header>

            <div id='playlist-table'>
                <div className='track-row header'>
                    <span className='col-index'>#</span>
                    <span className='col-title'>{t('columns.title')}</span>
                    <span className='col-album'>{t('columns.album')}</span>
                    <span className='col-release'>{t('columns.release')}</span>
                    <span className='col-added'>{t('columns.added')}</span>
                    <span className='col-duration'>{t('columns.duration')}</span>
                </div>

                {tracksLoading && <p className='playlist-hint'>{t('loading')}</p>}
                {!tracksLoading && sortedTracks.length === 0 && <p className='playlist-hint'>{t('empty')}</p>}

                {!tracksLoading &&
                    sortedTracks.map((track, index) => (
                        <div
                            key={`${track.uri}-${track.position}`}
                            className={`track-row ${selectedTrack?.position === track.position ? 'active' : ''}`}
                            draggable
                            title={t('row-tooltip')}
                            onDragStart={(e) => handleTrackDragStart(e, track)}
                            onClick={() => setSelectedTrack(track)}
                        >
                            <span className='col-index'>{index + 1}</span>

                            <span className='col-title'>
                                {track.albumImageUrl ? (
                                    <img className='track-cover' src={track.albumImageUrl} alt='' loading='lazy' />
                                ) : (
                                    <span className='track-cover placeholder'>
                                        <Icon name='music' size={12} />
                                    </span>
                                )}
                                <span className='track-title-text'>
                                    <span className='track-name'>
                                        {track.name}
                                        {track.explicit && <span className='explicit-tag'>E</span>}
                                        {track.isLocal && <span className='local-tag'>{t('local')}</span>}
                                    </span>
                                    <span className='track-artist'>{track.artistLabel}</span>
                                </span>
                            </span>

                            <span className='col-album'>{track.albumName}</span>

                            <span className='col-release'>
                                <span
                                    className={`release-chip precision-${track.releaseDatePrecision ?? 'unknown'}`}
                                    title={t(`precision.${track.releaseDatePrecision ?? 'unknown'}`)}
                                >
                                    {track.releaseDateLabel}
                                </span>
                            </span>

                            <span className='col-added'>{track.addedAtLabel}</span>
                            <span className='col-duration'>{track.durationLabel}</span>
                        </div>
                    ))}
            </div>

            {selectedTrack && playlist && (
                <TrackVariantsPanel
                    playlist={playlist}
                    track={selectedTrack}
                    onClose={() => setSelectedTrack(null)}
                    onReplaced={() => loadTracks(playlist.id)}
                />
            )}
        </div>
    );
};

export default PlaylistView;
