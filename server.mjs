import https from 'https';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { handler } = await import('./dist/server/entry.mjs');

const options = {
  key: fs.readFileSync(join(__dirname, 'certs/localhost.key')),
  cert: fs.readFileSync(join(__dirname, 'certs/localhost.crt')),
};

const server = https.createServer(options, handler);

const port = process.env.PORT || 3000;
server.listen(port, '127.0.0.1', () => {
  console.log(`HTTPS Server running at https://localhost:${port}`);
});
