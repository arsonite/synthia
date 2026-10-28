/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Login view. Guides through the one-time Spotify app setup (client id and
 * redirect URI) and starts the PKCE authorization flow.
 */

// React imports
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

// Components
import Icon from '@/components/Icon';
import IconButton from '@/components/IconButton';

// API
import SpotifyAuth from '@/api/SpotifyAuth';

// Style
import './_style/LoginView.scss';

interface ILoginViewState {
    clientId: string;
}

const LoginView: React.FC = () => {
    // Translation
    const { t } = useTranslation('app', { keyPrefix: 'login' });

    // State
    const [clientId, setClientId] = useState<ILoginViewState['clientId']>(SpotifyAuth.getClientId() ?? '');

    // Handler functions
    const handleConnect = async () => {
        const trimmed = clientId.trim();
        if (!trimmed) {
            toast.error(t('client-id-missing'));
            return;
        }

        SpotifyAuth.setClientId(trimmed);
        try {
            await SpotifyAuth.login();
        } catch (e) {
            console.error(e);
            toast.error(t('login-failed'));
        }
    };

    return (
        <div id='login-view'>
            <div id='login-card'>
                <div id='login-brand'>
                    <Icon name='spotify' size={40} />
                    <h1>{t('title')}</h1>
                    <p id='login-subtitle'>{t('subtitle')}</p>
                </div>

                <div id='login-setup'>
                    <label htmlFor='client-id-input'>{t('client-id-label')}</label>
                    <input
                        id='client-id-input'
                        type='text'
                        autoComplete='off'
                        spellCheck={false}
                        placeholder={t('client-id-placeholder')}
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleConnect();
                        }}
                    />

                    <p className='hint'>{t('client-id-hint')}</p>
                    <p className='hint'>
                        {t('redirect-hint')} <code>{SpotifyAuth.getRedirectUri()}</code>
                    </p>
                </div>

                <IconButton filled icon='spotify' size='big' theme='green' onClick={handleConnect}>
                    {t('connect-button')}
                </IconButton>
            </div>
        </div>
    );
};

export default LoginView;
