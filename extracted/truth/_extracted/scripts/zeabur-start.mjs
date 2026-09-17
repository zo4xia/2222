import { createServer } from 'vite';

const port = Number(process.env.PORT || process.env.ZEABUR_PORT || 3000);

if (!Number.isFinite(port) || port <= 0) {
  throw new Error(`Invalid PORT: ${process.env.PORT || process.env.ZEABUR_PORT}`);
}

const server = await createServer({
  configFile: 'vite.config.mjs',
  server: {
    allowedHosts: true,
    host: '0.0.0.0',
    port,
    strictPort: true,
  },
});

await server.listen();
server.printUrls();
