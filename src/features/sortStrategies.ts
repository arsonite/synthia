/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Track sort strategy registry. Add a new entry here and it automatically
 * appears in the playlist view's sort dropdown.
 */

// Classes
import { Track } from '@/classes/Track';

export interface ISortStrategy {
    id: string;
    /** i18n key inside the 'sort' group */
    labelKey: string;
    compare: (a: Track, b: Track) => number;
}

// Nulls (unknown values) always sort to the end, regardless of direction
const compareNullable = (a: number | null, b: number | null): number => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
};

export const sortStrategies: ISortStrategy[] = [
    {
        id: 'custom',
        labelKey: 'custom',
        compare: (a, b) => a.position - b.position,
    },
    {
        id: 'title',
        labelKey: 'title',
        compare: (a, b) => a.name.localeCompare(b.name),
    },
    {
        id: 'artist',
        labelKey: 'artist',
        compare: (a, b) => a.artistLabel.localeCompare(b.artistLabel) || a.name.localeCompare(b.name),
    },
    {
        id: 'album',
        labelKey: 'album',
        compare: (a, b) => a.albumName.localeCompare(b.albumName) || a.position - b.position,
    },
    {
        id: 'release-date',
        labelKey: 'release-date',
        compare: (a, b) => compareNullable(a.releaseTimestamp, b.releaseTimestamp),
    },
    {
        id: 'added',
        labelKey: 'added',
        compare: (a, b) =>
            compareNullable(a.addedAt ? Date.parse(a.addedAt) : null, b.addedAt ? Date.parse(b.addedAt) : null),
    },
    {
        id: 'duration',
        labelKey: 'duration',
        compare: (a, b) => a.durationMs - b.durationMs,
    },
    {
        id: 'popularity',
        labelKey: 'popularity',
        compare: (a, b) => compareNullable(b.popularity, a.popularity),
    },
];

/**
 * Resolves a sort strategy by id, falling back to the custom order.
 * @param id - The strategy id.
 * @returns The matching strategy.
 */
export const getSortStrategy = (id: string): ISortStrategy => {
    return sortStrategies.find((strategy) => strategy.id === id) ?? sortStrategies[0];
};

/**
 * Sorts tracks with a strategy and direction. Unknown values stay at the end
 * even when the direction is inverted.
 * @param tracks - The tracks to sort (not mutated).
 * @param strategyId - The strategy id.
 * @param ascending - The sort direction.
 * @returns A new sorted array.
 */
export const sortTracks = (tracks: Track[], strategyId: string, ascending: boolean): Track[] => {
    const strategy = getSortStrategy(strategyId);
    const factor = ascending ? 1 : -1;

    return [...tracks].sort((a, b) => {
        const result = strategy.compare(a, b);
        // Keep unknown release dates at the end in both directions
        if (strategyId === 'release-date' && (a.releaseTimestamp === null || b.releaseTimestamp === null)) {
            return result;
        }
        return result * factor;
    });
};
