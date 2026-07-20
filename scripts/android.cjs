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

const llamaJniLibs = path.join(
  root,
  'node_modules',
  'llama.rn',
  'android',
  'src',
  'main',
  'jniLibs',
);
const llamaArm64Prebuilt = path.join(llamaJniLibs, 'arm64-v8a', 'librnllama.so');
if (!fs.existsSync(llamaArm64Prebuilt)) {
  console.error('llama.rn native libs are missing (JSI bindings will fail at runtime).');
  console.error('Run: node ./node_modules/llama.rn/install/download-native-artifacts.js');
  console.error('Then: npm run clean && npm run android:clean');
  process.exit(1);
}

// Stale CMake configs (from builds before jniLibs existed) skip librnllama_jni*.so.
// Without those wrappers, RNLlama.loadNative fails → "JSI bindings not installed".
const cxxDir = path.join(root, 'android', 'app', '.cxx');
const mergedDebugJni = path.join(
  root,
  'android',
  'app',
  'build',
  'intermediates',
  'merged_native_libs',
  'debug',
  'mergeDebugNativeLibs',
  'out',
  'lib',
  'arm64-v8a',
  'librnllama_jni.so',
);
const mergedDebugPrebuilt = path.join(
  path.dirname(mergedDebugJni),
  'librnllama.so',
);
if (
  fs.existsSync(mergedDebugPrebuilt) &&
  !fs.existsSync(mergedDebugJni) &&
  fs.existsSync(cxxDir)
) {
  console.warn(
    'Detected stale Android native cache: librnllama.so present but librnllama_jni.so missing.',
  );
  console.warn('Clearing android/app/.cxx so llama.rn JNI wrappers rebuild...');
  fs.rmSync(cxxDir, { recursive: true, force: true });
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

async function pickMetroPort() {
  const preferredPorts = [8081, 8082, 8083, 8084];
  for (const port of preferredPorts) {
    if (!(await portInUse(port))) {
      return port;
    }
  }
  return 8082;
}

async function main() {
  const userArgs = process.argv.slice(2);
  const hasPort = userArgs.some((arg) => {
    if (arg === '--port') return true;
    if (arg.startsWith('--port=')) return true;
    return false;
  });

  const expoArgs = ['run:android'];

  if (!hasPort) {
    const port = await pickMetroPort();
    expoArgs.push('--port', String(port));
    if (port !== 8081) {
      console.log(`Metro port 8081 is busy — using ${port} for this run.`);
    }
  }

  expoArgs.push(...userArgs);

  const child = spawn(process.execPath, [expoCli, ...expoArgs], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });

  child.on('exit', (code) => process.exit(code ?? 1));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
