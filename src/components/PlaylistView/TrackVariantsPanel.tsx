/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Variants panel. Searches Spotify for other releases of the selected track
 * (single, album, remaster, compilation) and lists them by release date, so
 * the copy with the most accurate date can replace the one in the playlist.
 */

// React imports
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

// Components
import Icon from '@/components/Icon';
import IconButton from '@/components/IconButton';

// Classes
import { Playlist } from '@/classes/Playlist';
import { Track } from '@/classes/Track';

// API
import SpotifyAPI from '@/api/SpotifyAPI';

// Utility
import LibrarySnapshot from '@/util/LibrarySnapshot';
import { setDragEntity } from '@/util/DragPayload';

// Style
import './_style/PlaylistView.scss';

interface ITrackVariantsPanelProps {
    playlist: Playlist;
    track: Track;
    onClose: () => void;
    /** Called after a successful replacement so the playlist can refetch */
    onReplaced: () => void;
}

interface ITrackVariantsPanelState {
    loading: boolean;
    replacingUri: string | null;
    variants: Track[];
}

const TrackVariantsPanel: React.FC<ITrackVariantsPanelProps> = (props) => {
    // Translation
    const { t } = useTranslation('app', { keyPrefix: 'variants' });

    // State
    const [loading, setLoading] = useState<ITrackVariantsPanelState['loading']>(true);
    const [replacingUri, setReplacingUri] = useState<ITrackVariantsPanelState['replacingUri']>(null);
    const [variants, setVariants] = useState<ITrackVariantsPanelState['variants']>([]);

    // Handler functions
    const loadVariants = useCallback(
        async (track: Track) => {
            setLoading(true);
            try {
                const found = await SpotifyAPI.searchTrackVariants(track.name, track.artistNames[0] ?? '');

                // Deduplicate by URI and keep only actual title matches, then
                // sort by release date so the earliest release comes first
                const seen = new Set<string>();
                const needle = track.name.toLowerCase();
                const filtered = found.filter((candidate) => {
                    if (seen.has(candidate.uri)) return false;
                    seen.add(candidate.uri);
                    return candidate.name.toLowerCase().includes(needle) || needle.includes(candidate.name.toLowerCase());
                });
                filtered.sort((a, b) => {
                    if (a.releaseTimestamp === null) return 1;
                    if (b.releaseTimestamp === null) return -1;
                    return a.releaseTimestamp - b.releaseTimestamp;
                });

                setVariants(filtered);
            } catch (e) {
                console.error(e);
                setVariants([]);
                toast.error(t('search-failed'));
            } finally {
                setLoading(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    useEffect(() => {
        loadVariants(props.track);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.track.uri]);

    const handleReplace = async (variant: Track) => {
        if (replacingUri) return;
        setReplacingUri(variant.uri);

        try {
            // The replacement removes before it adds, so back the order up first
            await LibrarySnapshot.capturePlaylist(props.playlist, 'track-replace', props.playlist.ownerId);

            await SpotifyAPI.replaceTrackAtPosition(
                props.playlist.id,
                props.track.position,
                props.track.uri,
                variant.uri,
            );
            toast.success(t('replaced', { date: variant.releaseDateLabel }));
            props.onReplaced();
            props.onClose();
        } catch (e) {
            console.error(e);
            toast.error(t('replace-failed-restorable'), { duration: 12000 });
        } finally {
            setReplacingUri(null);
        }
    };

    const handleVariantDragStart = (e: React.DragEvent, variant: Track) => {
        setDragEntity(e, {
            kind: 'album',
            id: variant.albumId ?? variant.uri,
            name: variant.albumName,
            subtitle: variant.releaseDateLabel,
            meta: {
                trackUri: variant.uri,
                trackName: variant.name,
                albumType: variant.albumType,
                releaseDate: variant.releaseDate,
                releaseDatePrecision: variant.releaseDatePrecision,
            },
        });
    };

    return (
        <aside id='variants-panel'>
            <header id='variants-header'>
                <div>
                    <h2>{t('title')}</h2>
                    <p id='variants-subject'>
                        {props.track.name}
                        <span> {props.track.artistLabel}</span>
                    </p>
                </div>
                <IconButton hideBorder icon='x' size='small' theme='ghost' title={t('close')} onClick={props.onClose} />
            </header>

            <p id='variants-explainer'>{t('explainer')}</p>

            {loading && <p className='variants-hint'>{t('loading')}</p>}
            {!loading && variants.length === 0 && <p className='variants-hint'>{t('empty')}</p>}

            <div id='variants-list'>
                {!loading &&
                    variants.map((variant) => {
                        const isCurrent = variant.uri === props.track.uri;

                        return (
                            <div
                                key={variant.uri}
                                className={`variant-row ${isCurrent ? 'current' : ''}`}
                                draggable
                                onDragStart={(e) => handleVariantDragStart(e, variant)}
                            >
                                {variant.albumImageUrl ? (
                                    <img className='variant-cover' src={variant.albumImageUrl} alt='' loading='lazy' />
                                ) : (
                                    <span className='variant-cover placeholder'>
                                        <Icon name='music' size={14} />
                                    </span>
                                )}

                                <div className='variant-text'>
                                    <span className='variant-album'>
                                        {variant.albumName}
                                        {variant.albumType && (
                                            <span className='album-type-tag'>{t(`album-type.${variant.albumType}`)}</span>
                                        )}
                                    </span>
                                    <span className='variant-meta'>
                                        <span
                                            className={`release-chip precision-${variant.releaseDatePrecision ?? 'unknown'}`}
                                            title={t(`precision.${variant.releaseDatePrecision ?? 'unknown'}`)}
                                        >
                                            {variant.releaseDateLabel}
                                        </span>
                                        <span className='variant-duration'>{variant.durationLabel}</span>
                                        {isCurrent && <span className='current-tag'>{t('current')}</span>}
                                    </span>
                                </div>

                                {props.playlist.isOwn && !isCurrent && (
                                    <IconButton
                                        disabled={replacingUri !== null}
                                        icon='swap'
                                        size='tiny'
                                        theme='blue'
                                        title={t('replace-tooltip')}
                                        onClick={() => handleReplace(variant)}
                                    >
                                        {replacingUri === variant.uri ? t('replacing') : t('replace')}
                                    </IconButton>
                                )}
                            </div>
                        );
                    })}
            </div>
        </aside>
    );
};

export default TrackVariantsPanel;
