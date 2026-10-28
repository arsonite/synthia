/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Modal pop-up for confirmations and messages, following the pattern of the
 * enamentis frontend PopUp.
 */

// React imports
import { useTranslation } from 'react-i18next';

// Components
import Icon from '@/components/Icon';
import IconButton from '@/components/IconButton';

// Style
import './_style/PopUp.scss';

interface IPopUpProps {
    show: boolean;
    type: 'confirmation' | 'message';
    warning?: boolean;
    header: string;
    body?: React.ReactNode;
    children?: React.ReactNode;
    /** Called with the user's choice for confirmation pop-ups */
    handleChoice?: (choice: boolean) => void;
    /** Called when a message pop-up is dismissed */
    onClose?: () => void;
}

const PopUp: React.FC<IPopUpProps> = (props) => {
    // Translation
    const { t } = useTranslation('app', { keyPrefix: 'popup' });

    if (!props.show) return null;

    // Handler functions
    const dismiss = () => {
        if (props.type === 'confirmation') {
            props.handleChoice?.(false);
        } else {
            props.onClose?.();
        }
    };

    return (
        <div className='popup-backdrop' onClick={dismiss}>
            <div className={`popup ${props.warning ? 'warning' : ''}`} onClick={(e) => e.stopPropagation()}>
                <div className='popup-header'>
                    {props.warning && <Icon name='warning' size={20} />}
                    <h3>{props.header}</h3>
                </div>

                {props.body && <div className='popup-body'>{props.body}</div>}
                {props.children && <div className='popup-body'>{props.children}</div>}

                <div className='popup-actions'>
                    {props.type === 'confirmation' ? (
                        <>
                            <IconButton size='small' theme='gray' onClick={() => props.handleChoice?.(false)}>
                                {t('cancel')}
                            </IconButton>
                            <IconButton
                                filled
                                icon='check'
                                size='small'
                                theme={props.warning ? 'red' : 'green'}
                                onClick={() => props.handleChoice?.(true)}
                            >
                                {t('confirm')}
                            </IconButton>
                        </>
                    ) : (
                        <IconButton filled size='small' theme='gray' onClick={() => props.onClose?.()}>
                            {t('close')}
                        </IconButton>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PopUp;
