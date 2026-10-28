/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Folder picker pop-up. Lists the virtual folder tree (with indentation) and
 * lets the user pick a target folder or create a new one on the fly.
 */

// React imports
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Components
import Icon from '@/components/Icon';
import IconButton from '@/components/IconButton';

// Utility
import LibraryTree from '@/util/LibraryTree';

// Style
import './_style/Toolbar.scss';

interface IFolderPickerPopUpProps {
    show: boolean;
    onClose: () => void;
    /** Called with the picked folder id, or null for the root level */
    onPick: (folderId: string | null) => void;
}

interface IFolderPickerState {
    folderVersion: number;
    newFolderName: string;
    selectedId: string | null;
}

const FolderPickerPopUp: React.FC<IFolderPickerPopUpProps> = (props) => {
    // Translation
    const { t } = useTranslation('app', { keyPrefix: 'folder-picker' });

    // State
    const [folderVersion, setFolderVersion] = useState<IFolderPickerState['folderVersion']>(0);
    const [newFolderName, setNewFolderName] = useState<IFolderPickerState['newFolderName']>('');
    const [selectedId, setSelectedId] = useState<IFolderPickerState['selectedId']>(null);

    // Variables
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const folders = useMemo(() => LibraryTree.foldersWithDepth(), [props.show, folderVersion]);

    if (!props.show) return null;

    // Handler functions
    const handleCreateFolder = () => {
        const name = newFolderName.trim();
        if (!name) return;
        const folder = LibraryTree.createFolder(name);
        setNewFolderName('');
        setSelectedId(folder.id);
        setFolderVersion((version) => version + 1);
    };

    return (
        <div className='popup-backdrop' onClick={props.onClose}>
            <div className='popup' id='folder-picker' onClick={(e) => e.stopPropagation()}>
                <div className='popup-header'>
                    <Icon name='folder' size={18} />
                    <h3>{t('header')}</h3>
                </div>

                <div className='popup-body'>
                    <div id='folder-picker-list'>
                        <label className={`folder-option ${selectedId === null ? 'selected' : ''}`}>
                            <input
                                type='radio'
                                name='folder-picker-target'
                                checked={selectedId === null}
                                onChange={() => setSelectedId(null)}
                            />
                            <Icon name='home' size={14} />
                            <span>{t('root')}</span>
                        </label>

                        {folders.map(({ node, depth }) => (
                            <label
                                key={node.id}
                                className={`folder-option ${selectedId === node.id ? 'selected' : ''}`}
                                style={{ paddingLeft: `${0.75 + depth * 1.1}rem` }}
                            >
                                <input
                                    type='radio'
                                    name='folder-picker-target'
                                    checked={selectedId === node.id}
                                    onChange={() => setSelectedId(node.id)}
                                />
                                <Icon name='folder' size={14} />
                                <span>{node.name}</span>
                            </label>
                        ))}
                    </div>

                    <div id='folder-picker-create'>
                        <input
                            type='text'
                            placeholder={t('new-folder-placeholder')}
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateFolder();
                            }}
                        />
                        <IconButton
                            hideBorder
                            icon='folder-plus'
                            size='small'
                            theme='ghost'
                            title={t('create-tooltip')}
                            onClick={handleCreateFolder}
                        />
                    </div>
                </div>

                <div className='popup-actions'>
                    <IconButton size='small' theme='gray' onClick={props.onClose}>
                        {t('cancel')}
                    </IconButton>
                    <IconButton filled icon='move' size='small' theme='green' onClick={() => props.onPick(selectedId)}>
                        {t('move-here')}
                    </IconButton>
                </div>
            </div>
        </div>
    );
};

export default FolderPickerPopUp;
