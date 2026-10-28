/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Inline SVG icon set. All icons are 24x24 stroke drawings that inherit
 * currentColor, so themes work without extra assets.
 */

// React imports
import React from 'react';

export type TIconName =
    | 'arrow-down'
    | 'arrow-up'
    | 'attach'
    | 'calendar'
    | 'chat'
    | 'check'
    | 'chevron-down'
    | 'chevron-right'
    | 'drag'
    | 'edit'
    | 'external'
    | 'folder'
    | 'folder-plus'
    | 'globe'
    | 'home'
    | 'lock'
    | 'logout'
    | 'move'
    | 'music'
    | 'playlist'
    | 'plus'
    | 'refresh'
    | 'search'
    | 'send'
    | 'sliders'
    | 'sort'
    | 'spotify'
    | 'swap'
    | 'trash'
    | 'user'
    | 'warning'
    | 'x';

interface IIconProps {
    name: TIconName;
    size?: number;
    className?: string;
}

// Stroke path data per icon (24x24 grid)
const paths: Record<Exclude<TIconName, 'spotify'>, React.ReactNode> = {
    'arrow-down': <path d='M12 5v14m0 0l-6-6m6 6l6-6' />,
    'arrow-up': <path d='M12 19V5m0 0l-6 6m6-6l6 6' />,
    attach: (
        <path d='M21 12.5l-8.2 8.2a5.4 5.4 0 01-7.6-7.6L13.4 5a3.6 3.6 0 015 5l-8.1 8.1a1.8 1.8 0 01-2.5-2.5l7.5-7.5' />
    ),
    calendar: (
        <>
            <rect x='3.5' y='5' width='17' height='16' rx='2' />
            <path d='M3.5 10h17M8 2.5V7M16 2.5V7' />
        </>
    ),
    chat: <path d='M21 12a8 8 0 01-8 8H4l1.7-3.4A8 8 0 1121 12z' />,
    check: <path d='M4.5 12.5l5 5 10-11' />,
    'chevron-down': <path d='M6 9.5l6 6 6-6' />,
    'chevron-right': <path d='M9.5 6l6 6-6 6' />,
    drag: (
        <>
            <circle cx='9' cy='6' r='1.2' fill='currentColor' stroke='none' />
            <circle cx='15' cy='6' r='1.2' fill='currentColor' stroke='none' />
            <circle cx='9' cy='12' r='1.2' fill='currentColor' stroke='none' />
            <circle cx='15' cy='12' r='1.2' fill='currentColor' stroke='none' />
            <circle cx='9' cy='18' r='1.2' fill='currentColor' stroke='none' />
            <circle cx='15' cy='18' r='1.2' fill='currentColor' stroke='none' />
        </>
    ),
    edit: <path d='M4 20h4L20 8l-4-4L4 16v4zM13.5 6.5l4 4' />,
    external: <path d='M14 4h6v6M20 4l-9 9M20 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1h5' />,
    folder: (
        <path d='M3 6.5A1.5 1.5 0 014.5 5h4.6l2.2 2.5h8.2A1.5 1.5 0 0121 9v9.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18.5v-12z' />
    ),
    'folder-plus': (
        <>
            <path d='M3 6.5A1.5 1.5 0 014.5 5h4.6l2.2 2.5h8.2A1.5 1.5 0 0121 9v9.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18.5v-12z' />
            <path d='M12 10.5v6M9 13.5h6' />
        </>
    ),
    globe: (
        <>
            <circle cx='12' cy='12' r='9' />
            <path d='M3 12h18M12 3a13.5 13.5 0 010 18M12 3a13.5 13.5 0 000 18' />
        </>
    ),
    home: <path d='M4 11l8-7 8 7v8.5a1.5 1.5 0 01-1.5 1.5H15v-6h-6v6H5.5A1.5 1.5 0 014 19.5V11z' />,
    lock: (
        <>
            <rect x='5' y='11' width='14' height='9.5' rx='1.5' />
            <path d='M8 11V7.5a4 4 0 018 0V11' />
        </>
    ),
    logout: <path d='M15 4H6a1 1 0 00-1 1v14a1 1 0 001 1h9M10 12h11m0 0l-4-4m4 4l-4 4' />,
    move: (
        <path d='M12 2.5v19M12 2.5L8.5 6M12 2.5L15.5 6M12 21.5L8.5 18m3.5 3.5l3.5-3.5M2.5 12h19M2.5 12L6 8.5M2.5 12L6 15.5M21.5 12L18 8.5m3.5 3.5L18 15.5' />
    ),
    music: (
        <>
            <path d='M9 18.5V6l11-2.5V16' />
            <circle cx='6.5' cy='18.5' r='2.5' />
            <circle cx='17.5' cy='16' r='2.5' />
        </>
    ),
    playlist: <path d='M3.5 6.5h11M3.5 11h11M3.5 15.5H10m8.5-6v8m0-8L21 7m-2.5 2.5L16 7' />,
    plus: <path d='M12 5v14M5 12h14' />,
    refresh: <path d='M20 5v5h-5M4 19v-5h5M19.5 10a8 8 0 00-14-3.5M4.5 14a8 8 0 0014 3.5' />,
    search: (
        <>
            <circle cx='10.5' cy='10.5' r='6.5' />
            <path d='M15.5 15.5l5 5' />
        </>
    ),
    send: <path d='M21 3.5L10 14.5M21 3.5l-7 17-3-7.5-7.5-3 17.5-6.5z' />,
    sliders: <path d='M5 6.5h14M5 12h14M5 17.5h14M9 4.5v4M15 10v4M8 15.5v4' />,
    sort: <path d='M7 4.5v15m0 0l-3.5-4M7 19.5l3.5-4M17 19.5v-15m0 0l-3.5 4M17 4.5l3.5 4' />,
    swap: <path d='M4 8h14m0 0l-3.5-3.5M18 8l-3.5 3.5M20 16H6m0 0l3.5-3.5M6 16l3.5 3.5' />,
    trash: (
        <path d='M4.5 6.5h15M9.5 6.5V4.5a1 1 0 011-1h3a1 1 0 011 1v2m-8.5 0l1 13a1 1 0 001 1h6a1 1 0 001-1l1-13M10 10.5v6M14 10.5v6' />
    ),
    user: (
        <>
            <circle cx='12' cy='8' r='4' />
            <path d='M4.5 20.5a7.5 7.5 0 0115 0' />
        </>
    ),
    warning: <path d='M12 3.5l9.5 16.5H2.5L12 3.5zM12 10v4.5M12 17.5v.01' />,
    x: <path d='M5.5 5.5l13 13m0-13l-13 13' />,
};

/**
 * Renders a stroke icon by name. The Spotify mark is the only filled icon.
 */
const Icon: React.FC<IIconProps> = ({ name, size = 18, className = '' }) => {
    if (name === 'spotify') {
        return (
            <svg
                className={`icon icon-spotify ${className}`}
                width={size}
                height={size}
                viewBox='0 0 24 24'
                fill='currentColor'
                aria-hidden='true'
            >
                <path d='M12 2a10 10 0 100 20 10 10 0 000-20zm4.3 14.5a.7.7 0 01-.96.24c-2.6-1.6-5.9-1.96-9.8-1.07a.7.7 0 11-.3-1.37c4.25-.97 7.9-.55 10.82 1.24.33.2.44.63.24.96zm1.2-2.9a.87.87 0 01-1.2.3c-3-1.85-7.6-2.4-11.15-1.3a.87.87 0 11-.52-1.67c4.07-1.27 9.15-.65 12.6 1.47.4.25.53.79.27 1.2zm.1-3a1.05 1.05 0 01-1.44.36C12.7 9 7.4 8.8 4.13 9.8a1.05 1.05 0 11-.6-2c3.76-1.15 9.6-.93 13.7 1.5.5.3.66.94.37 1.3z' />
            </svg>
        );
    }

    return (
        <svg
            className={`icon icon-${name} ${className}`}
            width={size}
            height={size}
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='1.7'
            strokeLinecap='round'
            strokeLinejoin='round'
            aria-hidden='true'
        >
            {paths[name]}
        </svg>
    );
};

export default Icon;
