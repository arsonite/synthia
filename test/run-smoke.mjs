/**
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Bundles the smoke tests with esbuild (so the @ alias, TSX and SCSS imports
 * resolve exactly like in the app) and runs the result in node.
 */

import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
// The bundle stays inside the project so node resolves the externals
const outDir = path.join(root, 'node_modules', '.slm-smoke');
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'smoke.mjs');

await build({
    entryPoints: [path.join(here, 'smoke.tsx')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    outfile: outFile,
    jsx: 'automatic',
    // Stylesheets carry no logic, so they are stubbed out for the node run
    plugins: [
        {
            name: 'stub-styles',
            setup(pluginBuild) {
                pluginBuild.onResolve({ filter: /\.scss$/ }, (args) => ({
                    path: args.path,
                    namespace: 'stub-styles',
                }));
                pluginBuild.onLoad({ filter: /.*/, namespace: 'stub-styles' }, () => ({ contents: '' }));
            },
        },
    ],
    alias: { '@': path.join(root, 'src') },
    define: { 'import.meta.env.VITE_SPOTIFY_CLIENT_ID': '""' },
    external: ['react', 'react-dom', 'react-dom/server', 'react-router-dom', 'react-i18next', 'i18next', 'react-hot-toast'],
});

writeFileSync(path.join(outDir, 'package.json'), JSON.stringify({ type: 'module' }));

await import(path.join(here, 'shim.js'));
await import(outFile);
