/**
 * Build a release APK with the JS bundle embedded (for Firebase App Distribution).
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : 'gradlew';
const gradleCmd = path.join(root, 'android', gradlew);

const result = spawnSync(gradleCmd, ['assembleRelease'], {
  cwd: path.join(root, 'android'),
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const verify = spawnSync(process.execPath, [path.join(__dirname, 'verify-apk-bundle.cjs')], {
  cwd: root,
  stdio: 'inherit',
});

process.exit(verify.status ?? 0);
