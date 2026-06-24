import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { createApp } = await import('./app.js');
const app = await createApp();
const defaultPort = process.env.NODE_ENV === 'production' ? 10000 : 4000;
const port = Number(process.env.PORT || defaultPort);

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Voluptia prêt sur 0.0.0.0:${port}`);
  console.log(`Healthcheck disponible sur /api/health`);
});

function shutdown(signal) {
  console.log(`${signal} reçu : arrêt propre du serveur...`);
  server.close(() => {
    console.log('Serveur arrêté proprement.');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
