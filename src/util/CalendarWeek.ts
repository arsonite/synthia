/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * ISO 8601 calendar week helpers for the Discover Weekly archive naming scheme.
 */

export interface ICalendarWeek {
    week: number;
    year: number;
}

/**
 * Computes the ISO 8601 calendar week for a given date.
 * The ISO year can differ from the calendar year at year boundaries,
 * which matters for the "'YY" subfolder placement.
 * @param date - The date to compute the week for.
 * @returns The ISO week number and the ISO week-based year.
 */
export const getISOWeek = (date: Date): ICalendarWeek => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNumber = d.getUTCDay() || 7; // Sunday becomes 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNumber); // Shift to the Thursday of this week
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return { week, year: d.getUTCFullYear() };
};

/**
 * Formats a date as the playlist name used by the archiver, e.g. "KW 28'26".
 * @param date - The date to format.
 * @returns The formatted calendar week string.
 */
export const formatCalendarWeek = (date: Date): string => {
    const { week, year } = getISOWeek(date);
    return `KW ${String(week).padStart(2, '0')}'${String(year).slice(-2)}`;
};

/**
 * Formats a date as the year subfolder name used by the archiver, e.g. "'26".
 * @param date - The date to format.
 * @returns The formatted year folder string.
 */
export const formatYearFolder = (date: Date): string => {
    const { year } = getISOWeek(date);
    return `'${String(year).slice(-2)}`;
};
