/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Icon button adapted from the enamentis frontend component, reduced to the
 * themes and sizes this app uses and wired to the inline Icon set.
 */

// React imports
import { useMemo, useState } from 'react';

// Components
import Icon, { TIconName } from '@/components/Icon';

// Style
import './_style/IconButton.scss';

export type TIconButtonTheme = 'green' | 'gray' | 'red' | 'blue' | 'dark' | 'ghost';
export type TIconButtonSize = 'big' | 'regular' | 'small' | 'tiny';

interface IIconButtonProps {
    children?: React.ReactNode;
    className?: string;
    disabled?: boolean;
    filled?: boolean;
    hideBorder?: boolean;
    icon?: TIconName;
    id?: string;
    size?: TIconButtonSize;
    theme?: TIconButtonTheme;
    title?: string;
    onClick: () => void;
}

interface IIconButtonState {
    isHovering: boolean;
}

const iconSizes: Record<TIconButtonSize, number> = {
    big: 20,
    regular: 18,
    small: 16,
    tiny: 14,
};

const IconButton: React.FC<IIconButtonProps> = ({
    children,
    className = '',
    disabled = false,
    filled = false,
    hideBorder = false,
    icon,
    id,
    size = 'regular',
    theme = 'dark',
    title,
    onClick,
}) => {
    // State
    const [isHovering, setIsHovering] = useState<IIconButtonState['isHovering']>(false);

    // Variables
    const propsClasses = useMemo(() => {
        const classNames = ['icon-button'];
        classNames.push(`size-${size}`);
        classNames.push(`theme-${theme}`);
        if (className) classNames.push(className);
        if (disabled) classNames.push('disabled');
        if (filled) classNames.push('filled');
        if (hideBorder) classNames.push('hide-border');
        if (!children) classNames.push('icon-only');
        return classNames.join(' ');
    }, [children, className, disabled, filled, hideBorder, size, theme]);

    const computedClasses = useMemo(() => {
        const classNames = [propsClasses];
        if (isHovering && !disabled) classNames.push('hover');
        return classNames.join(' ');
    }, [propsClasses, disabled, isHovering]);

    return (
        <div
            className={computedClasses}
            id={id}
            title={title}
            onClick={() => {
                if (disabled) return;
                onClick();
            }}
            onMouseEnter={() => {
                if (disabled) return;
                setIsHovering(true);
            }}
            onMouseLeave={() => {
                setIsHovering(false);
            }}
        >
            {icon && <Icon name={icon} size={iconSizes[size]} />}
            {children && <p className='label'>{children}</p>}
        </div>
    );
};

export default IconButton;
