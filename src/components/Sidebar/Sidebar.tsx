/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Library sidebar. Renders the virtual folder tree with playlists, supports
 * drag reordering, moving into folders, multi-selection for mass actions,
 * folder management and the Discover Weekly shortcut.
 *
 * The tree lives entirely in LibraryTree (localStorage), because the Spotify
 * Web API exposes no folder or library-order endpoints.
 */

// React imports
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Components
import Icon from '@/components/Icon';
import IconButton from '@/components/IconButton';
import PopUp from '@/components/PopUp';

// Classes
import { Playlist } from '@/classes/Playlist';

// Context
import { useGlobalContext } from '@/withGlobalContext';

// Utility
import LibraryTree, { ITreeNode } from '@/util/LibraryTree';
import StorageHandler from '@/util/StorageHandler';
import { setDragEntity, setDragNodes, readDragNodes, dragHasType, NODE_MIME } from '@/util/DragPayload';

// Style
import './_style/Sidebar.scss';

type TDropZone = 'before' | 'after' | 'inside';

interface ISidebarProps {
    onArchiveDiscoverWeekly: () => void;
    refreshPlaylists: () => Promise<void>;
}

interface ISidebarState {
    dropTarget: { nodeId: string; zone: TDropZone } | null;
    dropOnRoot: boolean;
    editingNodeId: string | null;
    editingName: string;
    expandedIds: string[];
    filter: string;
    folderToDelete: ITreeNode | null;
}

const EXPANDED_KEY = 'library.tree.expanded';

const Sidebar: React.FC<ISidebarProps> = (props) => {
    // Translation
    const { t } = useTranslation('app', { keyPrefix: 'sidebar' });

    const navigate = useNavigate();
    const { id: activePlaylistId } = useParams();

    // Context
    const {
        playlists: [playlists],
        playlistsLoading: [playlistsLoading],
        treeVersion: [treeVersion, setTreeVersion],
        selectedPlaylistIds: [selectedPlaylistIds, setSelectedPlaylistIds],
    } = useGlobalContext();

    // State
    const [dropTarget, setDropTarget] = useState<ISidebarState['dropTarget']>(null);
    const [dropOnRoot, setDropOnRoot] = useState<ISidebarState['dropOnRoot']>(false);
    const [editingNodeId, setEditingNodeId] = useState<ISidebarState['editingNodeId']>(null);
    const [editingName, setEditingName] = useState<ISidebarState['editingName']>('');
    const [expandedIds, setExpandedIds] = useState<ISidebarState['expandedIds']>(
        (StorageHandler.get(EXPANDED_KEY, []) as string[]) ?? [],
    );
    const [filter, setFilter] = useState<ISidebarState['filter']>('');
    const [folderToDelete, setFolderToDelete] = useState<ISidebarState['folderToDelete']>(null);

    // Variables
    const playlistById = useMemo(() => {
        const map = new Map<string, Playlist>();
        playlists.forEach((playlist) => map.set(playlist.id, playlist));
        return map;
    }, [playlists]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const rootNodes = useMemo(() => LibraryTree.childrenOf(null), [treeVersion, playlists]);

    const filteredPlaylistNodes = useMemo(() => {
        if (!filter.trim()) return null;
        const needle = filter.trim().toLowerCase();
        return LibraryTree.allPlaylistNodes().filter((node) => node.name.toLowerCase().includes(needle));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter, treeVersion, playlists]);

    // Handler functions
    const bumpTree = () => setTreeVersion((version) => version + 1);

    const toggleExpanded = (folderId: string) => {
        setExpandedIds((current) => {
            const next = current.includes(folderId)
                ? current.filter((id) => id !== folderId)
                : [...current, folderId];
            StorageHandler.set(EXPANDED_KEY, next);
            return next;
        });
    };

    const toggleSelection = (playlistId: string) => {
        setSelectedPlaylistIds((current) =>
            current.includes(playlistId) ? current.filter((id) => id !== playlistId) : [...current, playlistId],
        );
    };

    const handleCreateFolder = () => {
        const folder = LibraryTree.createFolder(t('folder.new-name'));
        bumpTree();
        setEditingNodeId(folder.id);
        setEditingName(folder.name);
    };

    const commitRename = () => {
        if (editingNodeId && editingName.trim()) {
            LibraryTree.renameFolder(editingNodeId, editingName.trim());
            bumpTree();
        }
        setEditingNodeId(null);
        setEditingName('');
    };

    const handleDeleteFolder = (choice: boolean) => {
        if (choice && folderToDelete) {
            LibraryTree.deleteFolder(folderToDelete.id);
            bumpTree();
        }
        setFolderToDelete(null);
    };

    /**
     * Determines the drop zone from the cursor position: folders accept drops
     * before, inside and after (thirds), playlists before and after (halves).
     */
    const zoneFromEvent = (e: React.DragEvent, node: ITreeNode): TDropZone => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const ratio = (e.clientY - rect.top) / rect.height;
        if (node.type === 'folder') {
            if (ratio < 0.3) return 'before';
            if (ratio > 0.7) return 'after';
            return 'inside';
        }
        return ratio < 0.5 ? 'before' : 'after';
    };

    const handleRowDragStart = (e: React.DragEvent, node: ITreeNode) => {
        // Dragging a selected playlist moves the whole selection
        const nodeIds =
            node.type === 'playlist' && selectedPlaylistIds.includes(node.id) ? selectedPlaylistIds : [node.id];
        setDragNodes(e, nodeIds);

        // Playlists are also draggable into the chat as metadata attachments
        if (node.type === 'playlist') {
            const playlist = playlistById.get(node.id);
            if (playlist) {
                setDragEntity(e, {
                    kind: 'playlist',
                    id: playlist.id,
                    name: playlist.name,
                    subtitle: t('drag-subtitle', { count: playlist.trackCount }),
                    meta: {
                        uri: playlist.uri,
                        owner: playlist.ownerName,
                        trackCount: playlist.trackCount,
                        public: playlist.isPublic,
                        description: playlist.description ?? '',
                    },
                });
            }
        }
    };

    const handleRowDragOver = (e: React.DragEvent, node: ITreeNode) => {
        if (!dragHasType(e, NODE_MIME)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        const zone = zoneFromEvent(e, node);
        setDropTarget((current) =>
            current?.nodeId === node.id && current.zone === zone ? current : { nodeId: node.id, zone },
        );
        setDropOnRoot(false);
    };

    const handleRowDrop = (e: React.DragEvent, node: ITreeNode) => {
        const draggedIds = readDragNodes(e);
        setDropTarget(null);
        if (!draggedIds || draggedIds.length === 0) return;
        e.preventDefault();
        e.stopPropagation();

        const zone = zoneFromEvent(e, node);
        if (zone === 'inside' && node.type === 'folder') {
            LibraryTree.moveNodes(draggedIds, node.id);
        } else if (zone === 'before') {
            LibraryTree.moveNodes(draggedIds, node.parentId, node.id);
        } else {
            const siblings = LibraryTree.childrenOf(node.parentId);
            const nextSibling = siblings[siblings.findIndex((sibling) => sibling.id === node.id) + 1];
            LibraryTree.moveNodes(draggedIds, node.parentId, nextSibling?.id ?? null);
        }
        bumpTree();
    };

    const handleRootDrop = (e: React.DragEvent) => {
        const draggedIds = readDragNodes(e);
        setDropOnRoot(false);
        setDropTarget(null);
        if (!draggedIds || draggedIds.length === 0) return;
        e.preventDefault();
        LibraryTree.moveNodes(draggedIds, null);
        bumpTree();
    };

    // Render helpers
    const renderPlaylistRow = (node: ITreeNode, depth: number) => {
        const playlist = playlistById.get(node.id);
        const isSelected = selectedPlaylistIds.includes(node.id);
        const isActive = node.id === activePlaylistId;
        const zone = dropTarget?.nodeId === node.id ? dropTarget.zone : null;

        return (
            <div
                key={node.id}
                className={[
                    'tree-row',
                    'playlist-row',
                    isActive ? 'active' : '',
                    isSelected ? 'selected' : '',
                    zone ? `drop-${zone}` : '',
                ].join(' ')}
                style={{ paddingLeft: `${0.75 + depth * 1.1}rem` }}
                draggable
                onDragStart={(e) => handleRowDragStart(e, node)}
                onDragOver={(e) => handleRowDragOver(e, node)}
                onDragLeave={() => setDropTarget((current) => (current?.nodeId === node.id ? null : current))}
                onDrop={(e) => handleRowDrop(e, node)}
                onClick={() => navigate(`/playlist/${node.id}`)}
            >
                <span
                    className={`row-checkbox ${isSelected ? 'checked' : ''}`}
                    title={t('select-tooltip')}
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleSelection(node.id);
                    }}
                >
                    {isSelected && <Icon name='check' size={11} />}
                </span>

                {playlist?.imageUrl ? (
                    <img className='row-cover' src={playlist.imageUrl} alt='' loading='lazy' />
                ) : (
                    <span className='row-cover placeholder'>
                        <Icon name='music' size={12} />
                    </span>
                )}

                <span className='row-name' title={node.name}>
                    {node.name}
                </span>

                {playlist && !playlist.isOwn && <span className='row-owner-tag'>{playlist.ownerName}</span>}
                {playlist && (
                    <span className='row-visibility'>
                        <Icon name={playlist.isPublic ? 'globe' : 'lock'} size={12} />
                    </span>
                )}
            </div>
        );
    };

    const renderFolderRow = (node: ITreeNode, depth: number): React.ReactNode => {
        const isExpanded = expandedIds.includes(node.id);
        const isEditing = editingNodeId === node.id;
        const zone = dropTarget?.nodeId === node.id ? dropTarget.zone : null;
        const count = LibraryTree.countPlaylistsIn(node.id);

        return (
            <div key={node.id}>
                <div
                    className={['tree-row', 'folder-row', zone ? `drop-${zone}` : ''].join(' ')}
                    style={{ paddingLeft: `${0.75 + depth * 1.1}rem` }}
                    draggable={!isEditing}
                    onDragStart={(e) => handleRowDragStart(e, node)}
                    onDragOver={(e) => handleRowDragOver(e, node)}
                    onDragLeave={() => setDropTarget((current) => (current?.nodeId === node.id ? null : current))}
                    onDrop={(e) => handleRowDrop(e, node)}
                    onClick={() => toggleExpanded(node.id)}
                    onDoubleClick={() => {
                        setEditingNodeId(node.id);
                        setEditingName(node.name);
                    }}
                >
                    <span className='row-chevron'>
                        <Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} size={13} />
                    </span>
                    <span className='row-folder-icon'>
                        <Icon name='folder' size={14} />
                    </span>

                    {isEditing ? (
                        <input
                            className='row-rename-input'
                            autoFocus
                            value={editingName}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') commitRename();
                                if (e.key === 'Escape') {
                                    setEditingNodeId(null);
                                    setEditingName('');
                                }
                            }}
                        />
                    ) : (
                        <span className='row-name' title={node.name}>
                            {node.name}
                        </span>
                    )}

                    <span className='row-count'>{count}</span>
                    <span
                        className='row-action'
                        title={t('folder.delete-tooltip')}
                        onClick={(e) => {
                            e.stopPropagation();
                            setFolderToDelete(node);
                        }}
                    >
                        <Icon name='trash' size={13} />
                    </span>
                </div>

                {isExpanded && (
                    <div className='folder-children'>
                        {LibraryTree.childrenOf(node.id).map((child) => renderNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    const renderNode = (node: ITreeNode, depth: number): React.ReactNode => {
        return node.type === 'folder' ? renderFolderRow(node, depth) : renderPlaylistRow(node, depth);
    };

    return (
        <aside id='sidebar'>
            <PopUp
                show={folderToDelete !== null}
                type='confirmation'
                warning
                header={t('folder.delete-header')}
                body={<p>{t('folder.delete-body', { name: folderToDelete?.name ?? '' })}</p>}
                handleChoice={handleDeleteFolder}
            />

            <div id='sidebar-brand' onClick={() => navigate('/')}>
                <Icon name='spotify' size={22} />
                <span>{t('title')}</span>
            </div>

            <div id='sidebar-actions'>
                <div id='sidebar-filter'>
                    <Icon name='search' size={14} />
                    <input
                        type='text'
                        placeholder={t('filter-placeholder')}
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                    {filter && (
                        <span id='sidebar-filter-clear' onClick={() => setFilter('')}>
                            <Icon name='x' size={12} />
                        </span>
                    )}
                </div>

                <IconButton
                    hideBorder
                    icon='calendar'
                    size='small'
                    theme='ghost'
                    title={t('actions.archive-dw')}
                    onClick={props.onArchiveDiscoverWeekly}
                />
                <IconButton
                    hideBorder
                    icon='folder-plus'
                    size='small'
                    theme='ghost'
                    title={t('actions.new-folder')}
                    onClick={handleCreateFolder}
                />
                <IconButton
                    hideBorder
                    icon='refresh'
                    size='small'
                    theme='ghost'
                    title={t('actions.refresh')}
                    onClick={() => props.refreshPlaylists()}
                />
            </div>

            <nav
                id='sidebar-tree'
                className={dropOnRoot ? 'drop-on-root' : ''}
                onDragOver={(e) => {
                    if (!dragHasType(e, NODE_MIME)) return;
                    e.preventDefault();
                    setDropOnRoot(true);
                }}
                onDragLeave={(e) => {
                    if (e.currentTarget === e.target) setDropOnRoot(false);
                }}
                onDrop={handleRootDrop}
            >
                {playlistsLoading && <p className='sidebar-hint'>{t('loading')}</p>}

                {!playlistsLoading &&
                    (filteredPlaylistNodes !== null
                        ? filteredPlaylistNodes.length > 0
                          ? filteredPlaylistNodes.map((node) => renderPlaylistRow(node, 0))
                          : <p className='sidebar-hint'>{t('filter-empty')}</p>
                        : rootNodes.map((node) => renderNode(node, 0)))}

                {!playlistsLoading && <div id='sidebar-root-dropzone'>{t('root-dropzone')}</div>}
            </nav>
        </aside>
    );
};

export default Sidebar;
