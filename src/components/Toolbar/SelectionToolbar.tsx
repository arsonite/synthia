/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Floating selection toolbar. Appears when playlists are selected in the
 * sidebar and exposes the registered bulk actions.
 */

// React imports
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Components
import IconButton from '@/components/IconButton';
import FolderPickerPopUp from './FolderPickerPopUp';

// Context
import { useGlobalContext } from '@/withGlobalContext';

// Features
import { bulkActions } from '@/features/bulkActions';

// Utility
import LibraryTree from '@/util/LibraryTree';

// Types
import { tTranslationFunction } from '@/util/i18n.types';

// Style
import './_style/Toolbar.scss';

interface ISelectionToolbarProps {
    refreshPlaylists: () => Promise<void>;
}

interface ISelectionToolbarState {
    runningActionId: string | null;
}

const SelectionToolbar: React.FC<ISelectionToolbarProps> = (props) => {
    // Translation
    const { t } = useTranslation('app');

    // Context
    const {
        playlists: [playlists],
        selectedPlaylistIds: [selectedPlaylistIds, setSelectedPlaylistIds],
        folderPickerOpen: [folderPickerOpen, setFolderPickerOpen],
        treeVersion: [, setTreeVersion],
    } = useGlobalContext();

    // State
    const [runningActionId, setRunningActionId] = useState<ISelectionToolbarState['runningActionId']>(null);

    // Variables
    const selectedPlaylists = useMemo(
        () => playlists.filter((playlist) => selectedPlaylistIds.includes(playlist.id)),
        [playlists, selectedPlaylistIds],
    );

    if (selectedPlaylistIds.length === 0) return null;

    // Handler functions
    const handleRunAction = async (actionId: string) => {
        const action = bulkActions.find((candidate) => candidate.id === actionId);
        if (!action || runningActionId) return;

        setRunningActionId(action.id);
        try {
            await action.run(selectedPlaylists, {
                t: t as tTranslationFunction,
                refreshPlaylists: props.refreshPlaylists,
                openFolderPicker: () => setFolderPickerOpen(true),
                clearSelection: () => setSelectedPlaylistIds([]),
            });
        } finally {
            setRunningActionId(null);
        }
    };

    const handleFolderPick = (folderId: string | null) => {
        LibraryTree.moveNodes(selectedPlaylistIds, folderId);
        setTreeVersion((version) => version + 1);
        setFolderPickerOpen(false);
        setSelectedPlaylistIds([]);
    };

    return (
        <>
            <FolderPickerPopUp
                show={folderPickerOpen}
                onClose={() => setFolderPickerOpen(false)}
                onPick={handleFolderPick}
            />

            <div id='selection-toolbar'>
                <span id='selection-count'>{t('toolbar.selected', { count: selectedPlaylistIds.length })}</span>

                {bulkActions.map((action) => (
                    <IconButton
                        key={action.id}
                        disabled={runningActionId !== null}
                        icon={action.icon}
                        size='small'
                        theme={action.theme ?? 'dark'}
                        onClick={() => handleRunAction(action.id)}
                    >
                        {t(`toolbar.${action.labelKey}`)}
                    </IconButton>
                ))}

                <IconButton
                    hideBorder
                    icon='x'
                    size='small'
                    theme='ghost'
                    title={t('toolbar.clear')}
                    onClick={() => setSelectedPlaylistIds([])}
                />
            </div>
        </>
    );
};

export default SelectionToolbar;
