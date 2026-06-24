/**
 * Run Expo Android using the LOCAL cli from the project root.
 * Avoids `npx expo` which can hit npm ECOMPROMISED when run outside this folder.
 */
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const expoCli = path.join(root, 'node_modules', 'expo', 'bin', 'cli');

if (!fs.existsSync(expoCli)) {
  console.error('Expo is not installed. Run from the sitedairy folder:\n');
  console.error('  cd C:\\Projects\\sitedairy');
  console.error('  npm install');
  process.exit(1);
}

function portInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port, '127.0.0.1');
  });
}

async function main() {
  const userArgs = process.argv.slice(2);
  const hasPort = userArgs.some((arg, index) => {
    if (arg === '--port') return true;
    if (arg.startsWith('--port=')) return true;
    return false;
  });

  const expoArgs = ['run:android'];

  if (!hasPort) {
    const preferredPorts = [8081, 8082, 8083, 8084];
    for (const port of preferredPorts) {
      if (!(await portInUse(port))) {
        expoArgs.push('--port', String(port));
        break;
      }
    }
    if (!expoArgs.includes('--port')) {
      expoArgs.push('--port', '8082');
    }
  }

  expoArgs.push(...userArgs);

  const child = spawn(process.execPath, [expoCli, ...expoArgs], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      CI: '1',
    },
    shell: process.platform === 'win32',
  });

  child.on('exit', (code) => process.exit(code ?? 1));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

