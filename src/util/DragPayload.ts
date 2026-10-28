/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Shared drag-and-drop payload helpers. A single drag can carry two payloads:
 * - NODE_MIME: library tree node ids, consumed by the sidebar for move/reorder
 * - ENTITY_MIME: rich entity metadata, consumed by the chat panel as context
 */

export const NODE_MIME = 'application/x-slm-nodes';
export const ENTITY_MIME = 'application/x-slm-entity';

export type TDragEntityKind = 'playlist' | 'track' | 'album';

export interface IDragEntity {
    kind: TDragEntityKind;
    id: string;
    name: string;
    subtitle?: string;
    meta: Record<string, unknown>;
}

/**
 * Attaches library tree node ids to a drag event.
 * @param e - The drag event.
 * @param nodeIds - The node ids being dragged.
 */
export const setDragNodes = (e: React.DragEvent, nodeIds: string[]): void => {
    e.dataTransfer.setData(NODE_MIME, JSON.stringify(nodeIds));
    e.dataTransfer.effectAllowed = 'move';
};

/**
 * Reads library tree node ids from a drop event.
 * @param e - The drop event.
 * @returns The node ids or null if the drag carries no node payload.
 */
export const readDragNodes = (e: React.DragEvent): string[] | null => {
    const raw = e.dataTransfer.getData(NODE_MIME);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as string[];
    } catch (error) {
        return null;
    }
};

/**
 * Attaches an entity payload (playlist, track, album) to a drag event.
 * @param e - The drag event.
 * @param entity - The entity metadata.
 */
export const setDragEntity = (e: React.DragEvent, entity: IDragEntity): void => {
    e.dataTransfer.setData(ENTITY_MIME, JSON.stringify(entity));
};

/**
 * Reads an entity payload from a drop event.
 * @param e - The drop event.
 * @returns The entity or null if the drag carries no entity payload.
 */
export const readDragEntity = (e: React.DragEvent): IDragEntity | null => {
    const raw = e.dataTransfer.getData(ENTITY_MIME);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as IDragEntity;
    } catch (error) {
        return null;
    }
};

/**
 * Checks whether a drag event carries a given payload type.
 * Usable during dragover, where the payload itself is not readable yet.
 * @param e - The drag event.
 * @param type - The MIME type to check for.
 * @returns True if the drag carries the payload type.
 */
export const dragHasType = (e: React.DragEvent, type: string): boolean => {
    return Array.from(e.dataTransfer.types).includes(type);
};
