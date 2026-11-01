import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// The app's version, shown in the corner, comes from package.json only.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  // In development the leaderboard runs on PHP's built-in server (server/board.php on port 5203).
  server: { port: 5199, strictPort: true, proxy: { '/api/board.php': { target: 'http://127.0.0.1:5203', rewrite: () => '/board.php' } } },
  preview: { port: 5199, strictPort: true },
  build: { target: 'es2022', outDir: 'dist' },
});
