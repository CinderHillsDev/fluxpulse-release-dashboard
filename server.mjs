import https from 'https';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Generate self-signed cert if it doesn't exist
const certPath = join(__dirname, 'localhost.crt');
const keyPath = join(__dirname, 'localhost.key');

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.log('Generating self-signed certificate...');
  const { execSync } = await import('child_process');
  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout ${keyPath} -out ${certPath} -days 365 -nodes -subj "/CN=localhost"`,
    { stdio: 'inherit' }
  );
}

const { handler } = await import('./dist/server/entry.mjs');

const options = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

const server = https.createServer(options, handler);

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`HTTPS Server running at https://localhost:${port}`);
});
