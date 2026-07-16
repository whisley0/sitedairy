/**
 * Verify a release APK contains the embedded Hermes bundle (required for Firebase installs).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const apkPath = process.argv[2] || path.join(
  __dirname,
  '..',
  'android',
  'app',
  'build',
  'outputs',
  'apk',
  'release',
  'app-release.apk',
);

if (!fs.existsSync(apkPath)) {
  console.error(`APK not found: ${apkPath}`);
  process.exit(1);
}

const sizeMb = (fs.statSync(apkPath).size / (1024 * 1024)).toFixed(1);
const isDebug = apkPath.replace(/\\/g, '/').includes('/debug/');

if (isDebug) {
  console.error('This is a DEBUG APK. Debug builds do not embed the JS bundle.');
  console.error('Upload app-release.apk from the release folder, not app-debug.apk.');
  process.exit(1);
}

let listing = '';
try {
  if (process.platform === 'win32') {
    const escaped = apkPath.replace(/'/g, "''");
    listing = execSync(
      `powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::OpenRead('${escaped}').Entries | ForEach-Object { $_.FullName }"`,
      { encoding: 'utf8' },
    );
  } else {
    listing = execSync(`unzip -l "${apkPath}"`, { encoding: 'utf8' });
  }
} catch (error) {
  console.error('Could not inspect APK:', error.message);
  process.exit(1);
}

const hasBundle =
  listing.includes('assets/index.android.bundle') || listing.includes('index.android.bundle');

if (!hasBundle) {
  console.error(`APK (${sizeMb} MB) is missing assets/index.android.bundle.`);
  console.error('Rebuild with: npm run android:release');
  process.exit(1);
}

console.log(`OK: ${apkPath}`);
console.log(`Size: ${sizeMb} MB — bundle embedded (safe for Firebase App Distribution).`);
