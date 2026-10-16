import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

/**
 * `virtual:sample-images`: the X-rays in `public/test/`, as URLs.
 *
 * A static site cannot list a folder at runtime, so the list is read here, at
 * build time and whenever the dev server starts. Dropping a JPG or PNG into
 * the folder is all it takes to add a sample; in dev the page reloads with it.
 */
function sampleImages(): Plugin {
  const id = 'virtual:sample-images';
  const resolved = `\0${id}`;
  const dir = path.resolve(fileURLToPath(new URL('./public/test', import.meta.url)));

  const list = (): string[] => {
    try {
      return readdirSync(dir)
        .filter((name) => /\.(png|jpe?g)$/i.test(name))
        .sort()
        .map((name) => `/test/${encodeURIComponent(name)}`);
    } catch {
      return [];
    }
  };

  return {
    name: 'parupintas-sample-images',
    resolveId: (source) => (source === id ? resolved : undefined),
    load: (key) => (key === resolved ? `export default ${JSON.stringify(list())};` : undefined),
    configureServer(server) {
      server.watcher.add(dir);
      const refresh = (file: string) => {
        if (path.resolve(path.dirname(file)).toLowerCase() !== dir.toLowerCase()) return;
        const module = server.moduleGraph.getModuleById(resolved);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', refresh);
      server.watcher.on('unlink', refresh);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), sampleImages()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
