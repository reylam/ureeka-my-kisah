import 'dotenv/config';
import { createApp } from './src/app.js';
import { loadConfig } from './src/config/env.js';

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const app = createApp({ config });

const server = app.listen(config.port, () => {
  console.log(
    JSON.stringify({
      message: 'PARUPINTAS API listening',
      port: config.port,
      env: config.env,
      origins: config.frontendOrigins,
      modelConnected: Boolean(config.inference.url),
    }),
  );
});

function shutdown(signal) {
  console.log(JSON.stringify({ message: 'shutting down', signal }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
