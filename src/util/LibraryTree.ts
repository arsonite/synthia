/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Virtual library tree (folders + custom playlist order).
 *
 * IMPORTANT: The Spotify Web API exposes neither playlist folders nor the
 * order of the library sidebar (the "rootlist"). Both are client-only
 * concepts. This class therefore maintains its own tree in localStorage:
 * folders, nesting, and a custom order that survive across sessions in this
 * app, without ever syncing back to the official Spotify clients.
 */

// Classes
import { Playlist } from '@/classes/Playlist';

// Utility
import StorageHandler from '@/util/StorageHandler';

export type TTreeNodeType = 'folder' | 'playlist';

export interface ITreeNode {
    id: string;
    type: TTreeNodeType;
    name: string;
    parentId: string | null;
    index: number;
}

export interface IFolderWithDepth {
    node: ITreeNode;
    depth: number;
}

const STORAGE_KEY = 'library.tree.nodes';

class LibraryTree {
    private static nodes: Record<string, ITreeNode> | null = null;

    /**
     * Loads the tree from localStorage (once, then cached).
     * @returns The node map.
     */
    private static readonly load = (): Record<string, ITreeNode> => {
        if (LibraryTree.nodes === null) {
            LibraryTree.nodes = (StorageHandler.get(STORAGE_KEY, {}) as Record<string, ITreeNode>) ?? {};
        }
        return LibraryTree.nodes;
    };

    /**
     * Persists the tree to localStorage.
     */
    private static readonly save = (): void => {
        StorageHandler.set(STORAGE_KEY, LibraryTree.load());
    };

    /**
     * Normalizes the index values of all children of a parent to 0..n-1.
     * @param parentId - The parent to reindex.
     */
    private static readonly reindex = (parentId: string | null): void => {
        LibraryTree.childrenOf(parentId).forEach((node, index) => {
            node.index = index;
        });
    };

    /**
     * Returns a single node by id.
     * @param id - The node id.
     * @returns The node or undefined.
     */
    public static readonly getNode = (id: string): ITreeNode | undefined => {
        return LibraryTree.load()[id];
    };

    /**
     * Returns the sorted children of a parent (folders and playlists interleaved
     * by their custom index).
     * @param parentId - The parent folder id or null for the root level.
     * @returns The sorted child nodes.
     */
    public static readonly childrenOf = (parentId: string | null): ITreeNode[] => {
        return Object.values(LibraryTree.load())
            .filter((node) => node.parentId === parentId)
            .sort((a, b) => a.index - b.index);
    };

    /**
     * Synchronizes the tree with the playlists fetched from Spotify:
     * unknown playlists are appended at the root, stale playlist nodes are
     * removed, and names are refreshed. Folders are never touched.
     * @param playlists - The current playlists from the API.
     * @returns True if the tree changed.
     */
    public static readonly syncPlaylists = (playlists: Playlist[]): boolean => {
        const nodes = LibraryTree.load();
        let changed = false;

        const playlistIds = new Set(playlists.map((playlist) => playlist.id));

        // Remove playlist nodes that no longer exist on Spotify
        for (const node of Object.values(nodes)) {
            if (node.type === 'playlist' && !playlistIds.has(node.id)) {
                delete nodes[node.id];
                changed = true;
            }
        }

        // Add unknown playlists at the end of the root level, refresh names
        let nextRootIndex = LibraryTree.childrenOf(null).length;
        for (const playlist of playlists) {
            const existing = nodes[playlist.id];
            if (!existing) {
                nodes[playlist.id] = {
                    id: playlist.id,
                    type: 'playlist',
                    name: playlist.name,
                    parentId: null,
                    index: nextRootIndex++,
                };
                changed = true;
            } else if (existing.name !== playlist.name) {
                existing.name = playlist.name;
                changed = true;
            }
        }

        if (changed) LibraryTree.save();
        return changed;
    };

    /**
     * Creates a new folder.
     * @param name - The folder name.
     * @param parentId - The parent folder id or null for the root level.
     * @returns The created node.
     */
    public static readonly createFolder = (name: string, parentId: string | null = null): ITreeNode => {
        const nodes = LibraryTree.load();
        const node: ITreeNode = {
            id: `folder-${crypto.randomUUID()}`,
            type: 'folder',
            name,
            parentId,
            index: LibraryTree.childrenOf(parentId).length,
        };
        nodes[node.id] = node;
        LibraryTree.save();
        return node;
    };

    /**
     * Renames a folder.
     * @param id - The folder id.
     * @param name - The new name.
     */
    public static readonly renameFolder = (id: string, name: string): void => {
        const node = LibraryTree.load()[id];
        if (!node || node.type !== 'folder') return;
        node.name = name;
        LibraryTree.save();
    };

    /**
     * Deletes a folder and lifts its children into the folder's parent.
     * @param id - The folder id.
     */
    public static readonly deleteFolder = (id: string): void => {
        const nodes = LibraryTree.load();
        const folder = nodes[id];
        if (!folder || folder.type !== 'folder') return;

        const children = LibraryTree.childrenOf(id);
        const siblingCount = LibraryTree.childrenOf(folder.parentId).length;
        children.forEach((child, offset) => {
            child.parentId = folder.parentId;
            child.index = siblingCount + offset;
        });

        delete nodes[id];
        LibraryTree.reindex(folder.parentId);
        LibraryTree.save();
    };

    /**
     * Checks whether a node is a descendant of a folder (used to prevent
     * moving a folder into itself).
     * @param nodeId - The potential descendant.
     * @param ancestorId - The potential ancestor folder.
     * @returns True if nodeId lies below ancestorId.
     */
    public static readonly isDescendantOf = (nodeId: string, ancestorId: string): boolean => {
        let current = LibraryTree.load()[nodeId];
        while (current && current.parentId !== null) {
            if (current.parentId === ancestorId) return true;
            current = LibraryTree.load()[current.parentId];
        }
        return false;
    };

    /**
     * Moves one or more nodes into a target folder, optionally before a
     * specific sibling. This powers both mass moves and drag reordering.
     * @param ids - The node ids to move (order is preserved).
     * @param targetParentId - The target folder id or null for the root level.
     * @param beforeNodeId - Insert before this sibling, or null to append.
     */
    public static readonly moveNodes = (
        ids: string[],
        targetParentId: string | null,
        beforeNodeId: string | null = null,
    ): void => {
        const nodes = LibraryTree.load();

        // Filter out invalid moves (missing nodes, folder into itself or its own subtree)
        const movable = ids.filter((id) => {
            const node = nodes[id];
            if (!node) return false;
            if (targetParentId === null) return true;
            if (id === targetParentId) return false;
            return !(node.type === 'folder' && LibraryTree.isDescendantOf(targetParentId, id));
        });
        if (movable.length === 0) return;

        const previousParents = new Set(movable.map((id) => nodes[id].parentId));

        // Detach the moved nodes so the sibling list is clean
        for (const id of movable) {
            nodes[id].parentId = targetParentId;
            nodes[id].index = Number.MAX_SAFE_INTEGER;
        }

        // Build the new sibling order
        const siblings = LibraryTree.childrenOf(targetParentId).filter((node) => !movable.includes(node.id));
        const movedNodes = movable.map((id) => nodes[id]);
        let insertAt = siblings.length;
        if (beforeNodeId !== null && !movable.includes(beforeNodeId)) {
            const beforeIndex = siblings.findIndex((node) => node.id === beforeNodeId);
            if (beforeIndex !== -1) insertAt = beforeIndex;
        }
        siblings.splice(insertAt, 0, ...movedNodes);
        siblings.forEach((node, index) => {
            node.index = index;
        });

        // Clean up the indices of every parent the nodes came from
        previousParents.forEach((parentId) => {
            if (parentId !== targetParentId) LibraryTree.reindex(parentId ?? null);
        });

        LibraryTree.save();
    };

    /**
     * Registers a freshly created playlist directly inside a folder, so the
     * archiver can file new playlists without waiting for a full sync.
     * @param playlistId - The Spotify playlist id.
     * @param name - The playlist name.
     * @param folderId - The target folder id or null for the root level.
     */
    public static readonly fileNewPlaylist = (playlistId: string, name: string, folderId: string | null): void => {
        const nodes = LibraryTree.load();
        if (!nodes[playlistId]) {
            nodes[playlistId] = {
                id: playlistId,
                type: 'playlist',
                name,
                parentId: folderId,
                index: LibraryTree.childrenOf(folderId).length,
            };
            LibraryTree.save();
        } else {
            LibraryTree.moveNodes([playlistId], folderId);
        }
    };

    /**
     * Ensures a nested folder path exists (e.g. ['Weekly Mix', "'26"]) and
     * returns the id of the innermost folder.
     * @param names - The folder names from the root inwards.
     * @returns The id of the innermost folder.
     */
    public static readonly ensureFolderPath = (names: string[]): string => {
        let parentId: string | null = null;
        let folderId = '';
        for (const name of names) {
            const existing: ITreeNode | undefined = LibraryTree.childrenOf(parentId).find(
                (node) => node.type === 'folder' && node.name === name,
            );
            const folder: ITreeNode = existing ?? LibraryTree.createFolder(name, parentId);
            folderId = folder.id;
            parentId = folder.id;
        }
        return folderId;
    };

    /**
     * Returns all folders as a flat, depth-annotated list in tree order
     * (used by the folder picker).
     * @returns The folders with their depth.
     */
    public static readonly foldersWithDepth = (): IFolderWithDepth[] => {
        const result: IFolderWithDepth[] = [];
        const walk = (parentId: string | null, depth: number) => {
            for (const node of LibraryTree.childrenOf(parentId)) {
                if (node.type !== 'folder') continue;
                result.push({ node, depth });
                walk(node.id, depth + 1);
            }
        };
        walk(null, 0);
        return result;
    };

    /**
     * Returns a deep copy of the whole node map, used by the backup feature.
     * @returns A detached copy of the tree.
     */
    public static readonly exportNodes = (): Record<string, ITreeNode> => {
        return JSON.parse(JSON.stringify(LibraryTree.load())) as Record<string, ITreeNode>;
    };

    /**
     * Replaces the whole node map, used when restoring a backup.
     * Playlist nodes that no longer exist in the library are dropped by the
     * next syncPlaylists run, so the import stays tolerant here.
     * @param nodes - The node map to install.
     */
    public static readonly importNodes = (nodes: Record<string, ITreeNode>): void => {
        LibraryTree.nodes = JSON.parse(JSON.stringify(nodes)) as Record<string, ITreeNode>;
        LibraryTree.save();
    };

    /**
     * All playlist nodes in tree order, used by the flat filter view.
     * @returns The playlist nodes.
     */
    public static readonly allPlaylistNodes = (): ITreeNode[] => {
        const result: ITreeNode[] = [];
        const walk = (parentId: string | null) => {
            for (const node of LibraryTree.childrenOf(parentId)) {
                if (node.type === 'playlist') result.push(node);
                else walk(node.id);
            }
        };
        walk(null);
        return result;
    };

    /**
     * Counts the playlists inside a folder, including nested folders.
     * @param folderId - The folder id.
     * @returns The number of playlists.
     */
    public static readonly countPlaylistsIn = (folderId: string): number => {
        let count = 0;
        for (const node of LibraryTree.childrenOf(folderId)) {
            if (node.type === 'playlist') count++;
            else count += LibraryTree.countPlaylistsIn(node.id);
        }
        return count;
    };
}

export default LibraryTree;
