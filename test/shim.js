/**
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Minimal browser shims so the app modules can run inside node for the
 * smoke tests (no jsdom needed, the tests render to a string).
 */

const createStorage = () => {
    const data = new Map();
    return {
        getItem: (key) => (data.has(key) ? data.get(key) : null),
        setItem: (key, value) => data.set(key, String(value)),
        removeItem: (key) => data.delete(key),
        clear: () => data.clear(),
        key: (index) => Array.from(data.keys())[index] ?? null,
        get length() {
            return data.size;
        },
    };
};

globalThis.localStorage = createStorage();
globalThis.sessionStorage = createStorage();
globalThis.window = globalThis;
globalThis.location = { origin: 'http://127.0.0.1:5173', search: '', pathname: '/' };
globalThis.window.location = globalThis.location;
// react-hot-toast injects a style tag through goober, so a token document is needed
const createElement = () => ({
    innerHTML: '',
    id: '',
    nonce: undefined,
    firstChild: { data: '' },
    style: {},
    parentNode: null,
    appendChild(child) {
        child.parentNode = this;
        return child;
    },
    querySelector: () => null,
    setAttribute() {},
});

globalThis.document = {
    createElement,
    head: createElement(),
    body: createElement(),
    querySelector: () => null,
    getElementById: () => null,
    addEventListener() {},
};

globalThis.WebSocket = class {
    static OPEN = 1;
    readyState = 0;
    close() {}
    send() {}
};
