import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath =
  process.env.TIS_DB_PATH ?? join(os.homedir(), 'Documents', 'tis.sqlite');

const db = new Database(dbPath);

const app = express();
app.use(cors());
app.use(express.json());

const assetsPath = join(__dirname, '..', 'assets');
app.use('/assets', express.static(assetsPath));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${port}`);
  console.log(`SQLite database: ${dbPath}`);
});

process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
