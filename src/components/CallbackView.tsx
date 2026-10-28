/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * OAuth callback view. Exchanges the authorization code for tokens and
 * returns to the app.
 */

// React imports
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

// API
import SpotifyAuth from '@/api/SpotifyAuth';

// Style
import './_style/LoginView.scss';

const CallbackView: React.FC = () => {
    // Translation
    const { t } = useTranslation('app', { keyPrefix: 'callback' });

    const navigate = useNavigate();

    // Refs
    // WARNING: React StrictMode mounts twice; the code may only be exchanged once
    const exchangeStartedRef = useRef(false);

    useEffect(() => {
        if (exchangeStartedRef.current) return;
        exchangeStartedRef.current = true;

        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const error = params.get('error');

        if (error || !code) {
            toast.error(t('denied'));
            navigate('/login', { replace: true });
            return;
        }

        SpotifyAuth.handleCallback(code)
            .then(() => {
                navigate('/', { replace: true });
            })
            .catch((e) => {
                console.error(e);
                toast.error(t('exchange-failed'));
                navigate('/login', { replace: true });
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div id='callback-view'>
            <p>{t('connecting')}</p>
        </div>
    );
};

export default CallbackView;
