/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Adapted from the enamentis frontend StorageHandler (generic parts only).
 */

/**
 * StorageHandler class provides methods to interact with in-memory storage,
 * localStorage, and sessionStorage. It supports nested keys using dot notation.
 */
class StorageHandler {
    // Nested static class for sessionStorage operations
    public static readonly Session = class {
        public static get(key: string, defaultValue: unknown | null = null): unknown {
            const value = sessionStorage.getItem(key);
            if (value === null) return defaultValue;
            return value;
        }

        public static set(key: string, value: unknown): void {
            sessionStorage.setItem(key, value as string);
        }

        public static remove(key: string): void {
            sessionStorage.removeItem(key);
        }
    };

    // Nested static class for in-memory operations
    public static readonly Memory = class {
        private static memory: { [key: string]: unknown } = {};

        /**
         * Retrieves a value from the in-memory storage.
         * Supports nested keys using dot notation.
         * @param key - The key to retrieve the value for.
         * @returns The value associated with the key or null if not found.
         */
        public static readonly get = (key: string): unknown => {
            try {
                if (key.includes('.')) {
                    const keys = key.split('.');
                    let result = StorageHandler.Memory.memory as Record<string, unknown>;
                    for (const k of keys) {
                        result = result[k] as Record<string, unknown>;
                        if (result === undefined) return null;
                    }
                    return result;
                }
                return StorageHandler.Memory.memory[key];
            } catch (e) {
                return null;
            }
        };

        /**
         * Sets a value in the in-memory storage.
         * Supports nested keys using dot notation.
         * @param key - The key to set the value for.
         * @param value - The value to set.
         */
        public static readonly set = (key: string, value: unknown): void => {
            if (key.includes('.')) {
                const keys = key.split('.');
                let current = StorageHandler.Memory.memory as Record<string, unknown>;

                for (let i = 0; i < keys.length - 1; i++) {
                    const k = keys[i];
                    if (!(k in current) || typeof current[k] !== 'object') {
                        current[k] = {};
                    }
                    current = current[k] as Record<string, unknown>;
                }

                current[keys[keys.length - 1]] = value;
            } else {
                StorageHandler.Memory.memory[key] = value;
            }
        };

        /**
         * Clears all values from the in-memory storage.
         */
        public static readonly clear = (): void => {
            StorageHandler.Memory.memory = {};
        };
    };

    /**
     * Sets a value in localStorage.
     * Supports nested keys using dot notation.
     * @param key - The key to set the value for.
     * @param value - The value to set.
     */
    public static readonly set = (key: string, value: unknown): void => {
        if (key.includes('.')) {
            const keys = key.split('.');
            const storedData = localStorage.getItem(keys[0]);
            const currentData = storedData ? JSON.parse(storedData) : {};

            let current = currentData;
            for (let i = 1; i < keys.length - 1; i++) {
                const k = keys[i];
                if (!(k in current) || typeof current[k] !== 'object') {
                    current[k] = {};
                }
                current = current[k];
            }

            current[keys[keys.length - 1]] = value;
            localStorage.setItem(keys[0], JSON.stringify(currentData));
        } else {
            localStorage.setItem(key, JSON.stringify(value));
        }
    };

    /**
     * Retrieves a value from localStorage.
     * Supports nested keys using dot notation.
     * @param key - The key to retrieve the value for.
     * @param defaultValue - The default value to return if the key is not found.
     * @returns The value associated with the key or the default value if not found.
     */
    public static readonly get = (key: string, defaultValue: unknown = null): unknown => {
        try {
            if (key.includes('.')) {
                const keys = key.split('.');
                const storedData = localStorage.getItem(keys[0]);
                if (!storedData) return defaultValue;

                let current = JSON.parse(storedData);

                for (let i = 1; i < keys.length; i++) {
                    const k = keys[i];
                    if (current && k in current) {
                        current = current[k];
                    } else {
                        return defaultValue;
                    }
                }

                return current;
            }
            const json = localStorage.getItem(key);
            if (json === null) return defaultValue;
            return JSON.parse(json);
        } catch (e) {
            console.error(e);
            return defaultValue;
        }
    };

    /**
     * Removes a specific key from localStorage or sessionStorage.
     * Supports nested keys using dot notation.
     * @param key - The key to remove.
     * @param isSessionStorage - If true, use sessionStorage; otherwise, use localStorage.
     */
    public static readonly remove = (key: string, isSessionStorage = false): void => {
        const storage = isSessionStorage ? sessionStorage : localStorage;
        if (key.includes('.')) {
            const keys = key.split('.');
            const storedData = storage.getItem(keys[0]);
            if (!storedData) return;

            const currentData = JSON.parse(storedData);
            let current = currentData;

            for (let i = 1; i < keys.length - 1; i++) {
                const k = keys[i];
                if (!(k in current)) return;
                current = current[k];
            }

            delete current[keys[keys.length - 1]];
            storage.setItem(keys[0], JSON.stringify(currentData));
        } else {
            storage.removeItem(key);
        }
    };

    /**
     * Clears all data from localStorage or sessionStorage.
     * @param isSessionStorage - If true, clear sessionStorage; otherwise, clear localStorage.
     */
    public static readonly clear = (isSessionStorage = false): void => {
        const storage = isSessionStorage ? sessionStorage : localStorage;
        storage.clear();
    };
}

export default StorageHandler;
