const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function rm(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
    console.log('Removed', path.relative(root, target));
  }
}

rm(path.join(root, '.expo'));
rm(path.join(root, 'node_modules', '.cache'));
rm(path.join(root, 'android', 'app', 'build'));
rm(path.join(root, 'android', 'app', '.cxx'));
rm(path.join(root, 'android', 'build'));
rm(path.join(root, 'android', '.gradle'));
rm(path.join(root, 'node_modules', 'llama.rn', 'android', 'build'));
rm(path.join(root, 'node_modules', 'llama.rn', 'android', '.cxx'));

console.log('Cache cleared. Run: npm run android:clean');
