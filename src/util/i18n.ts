/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * i18n setup. A single 'app' namespace keeps the key tree flat enough for a
 * personal tool while still allowing keyPrefix scoping per component.
 */

// React imports
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Utility
import StorageHandler from '@/util/StorageHandler';

// Language files
import de from '@/_lang/de.json';
import en from '@/_lang/en.json';

const resources = {
    de: { app: de },
    en: { app: en },
};

const storedLanguage = StorageHandler.get('settings.ui.language', 'en') as string;

i18n.use(initReactI18next).init({
    resources,
    lng: storedLanguage,
    fallbackLng: 'en',
    ns: ['app'],
    defaultNS: 'app',
    interpolation: {
        escapeValue: false, // React already escapes values
    },
});

export default i18n;
