/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Entry point.
 */

// React imports
import { BrowserRouter } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import toast, { ToastBar, Toaster } from 'react-hot-toast';

// Components
import Client from './Client';
import ErrorBoundary from './components/ErrorBoundary';

// Utility
import './util/i18n';

// Style
import './_style/main.scss';

createRoot(document.getElementById('root')!).render(
    <BrowserRouter>
        <Toaster position='top-center' toastOptions={{ duration: 5000 }}>
            {(t) => (
                // Dismiss on click not included with hot toast
                <div onClick={() => toast.dismiss(t.id)}>
                    <ToastBar toast={t}>
                        {({ icon, message }) => (
                            <>
                                {icon}
                                {message}
                            </>
                        )}
                    </ToastBar>
                </div>
            )}
        </Toaster>

        <ErrorBoundary>
            <Client />
        </ErrorBoundary>
    </BrowserRouter>,
);
