/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Backup and recovery panel. Lists the automatic snapshots taken before every
 * destructive write, downloads a full backup file and restores either source
 * after showing what would change.
 */

// React imports
import { useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

// Components
import Icon from '@/components/Icon';
import IconButton from '@/components/IconButton';
import PopUp from '@/components/PopUp';

// Context
import { useGlobalContext } from '@/withGlobalContext';

// Utility
import LibrarySnapshot, { ILibrarySnapshot, IRestorePreviewEntry } from '@/util/LibrarySnapshot';

// Style
import './_style/BackupPanel.scss';

interface IBackupPanelProps {
    refreshPlaylists: () => Promise<void>;
}

interface IBackupPanelState {
    busyLabel: string | null;
    pending: ILibrarySnapshot | null;
    preview: IRestorePreviewEntry[] | null;
    snapshots: ILibrarySnapshot[];
    toDelete: ILibrarySnapshot | null;
}

const BackupPanel: React.FC<IBackupPanelProps> = (props) => {
    // Translation
    const { t } = useTranslation('app', { keyPrefix: 'backup' });

    // Context
    const {
        user: [user],
        playlists: [playlists],
        treeVersion: [, setTreeVersion],
    } = useGlobalContext();

    // State
    const [busyLabel, setBusyLabel] = useState<IBackupPanelState['busyLabel']>(null);
    const [pending, setPending] = useState<IBackupPanelState['pending']>(null);
    const [preview, setPreview] = useState<IBackupPanelState['preview']>(null);
    const [snapshots, setSnapshots] = useState<IBackupPanelState['snapshots']>(LibrarySnapshot.list());
    const [toDelete, setToDelete] = useState<IBackupPanelState['toDelete']>(null);

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Variables
    const dateFormatter = useMemo(
        () => new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }),
        [],
    );

    // Handler functions
    const handleDownload = async () => {
        if (busyLabel || !user) return;
        setBusyLabel(t('working.capturing', { done: 0, total: playlists.length }));

        try {
            const snapshot = await LibrarySnapshot.captureLibrary(playlists, user.id, (done, total) => {
                setBusyLabel(t('working.capturing', { done, total }));
            });

            const { fileName, content } = LibrarySnapshot.toFile(snapshot);
            const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.click();
            URL.revokeObjectURL(url);

            toast.success(t('downloaded', { count: snapshot.playlists.length }));
        } catch (e) {
            console.error(e);
            toast.error(t('download-failed'));
        } finally {
            setBusyLabel(null);
        }
    };

    const handleFileChosen = async (file: File | undefined) => {
        if (!file) return;

        try {
            const snapshot = LibrarySnapshot.fromFile(await file.text());
            await openPreview(snapshot);
        } catch (e) {
            console.error(e);
            toast.error(t('file-invalid'));
        } finally {
            // Allow picking the same file again
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const openPreview = async (snapshot: ILibrarySnapshot) => {
        setBusyLabel(t('working.comparing'));
        try {
            const entries = await LibrarySnapshot.previewRestore(snapshot, playlists);
            setPending(snapshot);
            setPreview(entries);
        } catch (e) {
            console.error(e);
            toast.error(t('preview-failed'));
        } finally {
            setBusyLabel(null);
        }
    };

    const handleRestore = async (choice: boolean) => {
        const snapshot = pending;
        setPending(null);
        setPreview(null);
        if (!choice || !snapshot) return;

        setBusyLabel(t('working.restoring', { done: 0, total: snapshot.playlists.length }));
        try {
            const result = await LibrarySnapshot.restoreSnapshot(snapshot, playlists, (done, total) => {
                setBusyLabel(t('working.restoring', { done, total }));
            });

            setTreeVersion((version) => version + 1);
            setSnapshots(LibrarySnapshot.list());
            await props.refreshPlaylists();

            if (result.restoredPlaylists > 0) {
                toast.success(
                    t('restored', { playlists: result.restoredPlaylists, tracks: result.restoredTracks }),
                );
            }
            if (result.skippedLocal > 0) {
                toast(t('restored-skipped-local', { count: result.skippedLocal }));
            }
            result.failed.forEach((failure) => {
                toast.error(t('restore-entry-failed', { name: failure.name, message: failure.message }));
            });
        } catch (e) {
            console.error(e);
            toast.error(t('restore-failed'));
        } finally {
            setBusyLabel(null);
        }
    };

    const handleDelete = (choice: boolean) => {
        if (choice && toDelete) {
            LibrarySnapshot.remove(toDelete.id);
            setSnapshots(LibrarySnapshot.list());
        }
        setToDelete(null);
    };

    return (
        <section className='home-card' id='backup-panel'>
            <PopUp
                show={pending !== null}
                type='confirmation'
                warning
                header={t('confirm.header')}
                handleChoice={handleRestore}
            >
                <p>{t('confirm.body', { label: pending?.label ?? '' })}</p>

                <div id='restore-preview'>
                    {preview?.map((entry) => (
                        <div key={entry.name} className={`preview-row state-${entry.state}`}>
                            <span className='preview-name'>{entry.name}</span>
                            <span className='preview-state'>{t(`state.${entry.state}`)}</span>
                            <span className='preview-counts'>
                                {entry.state === 'missing'
                                    ? t('counts.missing')
                                    : t('counts.tracks', {
                                          live: entry.liveTrackCount ?? '?',
                                          backup: entry.backupTrackCount,
                                      })}
                            </span>
                        </div>
                    ))}
                </div>

                <p className='confirm-note'>{t('confirm.note')}</p>
            </PopUp>

            <PopUp
                show={toDelete !== null}
                type='confirmation'
                warning
                header={t('delete.header')}
                body={<p>{t('delete.body', { label: toDelete?.label ?? '' })}</p>}
                handleChoice={handleDelete}
            />

            <h2>
                <Icon name='refresh' size={18} /> {t('title')}
            </h2>
            <p>{t('description')}</p>

            <div id='backup-actions'>
                <IconButton
                    disabled={busyLabel !== null || !user}
                    icon='arrow-down'
                    size='small'
                    theme='green'
                    onClick={handleDownload}
                >
                    {t('download')}
                </IconButton>
                <IconButton
                    disabled={busyLabel !== null}
                    icon='arrow-up'
                    size='small'
                    theme='blue'
                    onClick={() => fileInputRef.current?.click()}
                >
                    {t('restore-from-file')}
                </IconButton>
                <input
                    ref={fileInputRef}
                    id='backup-file-input'
                    type='file'
                    accept='application/json,.json'
                    onChange={(e) => handleFileChosen(e.target.files?.[0])}
                />
                {busyLabel && <span id='backup-busy'>{busyLabel}</span>}
            </div>

            <h3 id='snapshot-heading'>{t('automatic-title')}</h3>
            <p className='snapshot-hint'>{t('automatic-hint')}</p>

            {snapshots.length === 0 && <p className='snapshot-hint'>{t('automatic-empty')}</p>}

            <div id='snapshot-list'>
                {snapshots.map((snapshot) => (
                    <div key={snapshot.id} className='snapshot-row'>
                        <span className='snapshot-reason'>{t(`reason.${snapshot.reason}`)}</span>
                        <span className='snapshot-label' title={snapshot.label}>
                            {snapshot.label}
                        </span>
                        <span className='snapshot-time'>{dateFormatter.format(new Date(snapshot.takenAt))}</span>
                        <span className='snapshot-size'>
                            {t('snapshot-size', {
                                playlists: snapshot.playlists.length,
                                tracks: snapshot.playlists.reduce(
                                    (sum, entry) => sum + (entry.trackUris?.length ?? 0),
                                    0,
                                ),
                            })}
                        </span>

                        <IconButton
                            disabled={busyLabel !== null}
                            icon='swap'
                            size='tiny'
                            theme='blue'
                            title={t('restore-tooltip')}
                            onClick={() => openPreview(snapshot)}
                        >
                            {t('restore')}
                        </IconButton>
                        <IconButton
                            hideBorder
                            disabled={busyLabel !== null}
                            icon='arrow-down'
                            size='tiny'
                            theme='ghost'
                            title={t('save-tooltip')}
                            onClick={() => {
                                const { fileName, content } = LibrarySnapshot.toFile(snapshot);
                                const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = fileName;
                                link.click();
                                URL.revokeObjectURL(url);
                            }}
                        />
                        <IconButton
                            hideBorder
                            disabled={busyLabel !== null}
                            icon='trash'
                            size='tiny'
                            theme='ghost'
                            title={t('delete-tooltip')}
                            onClick={() => setToDelete(snapshot)}
                        />
                    </div>
                ))}
            </div>
        </section>
    );
};

export default BackupPanel;
