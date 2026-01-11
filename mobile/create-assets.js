const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir);
}

// Minimal valid PNG (1x1 blue pixel)
const minPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const files = ['icon.png', 'adaptive-icon.png', 'splash.png', 'notification-icon.png'];

files.forEach((file) => {
  fs.writeFileSync(path.join(assetsDir, file), minPng);
  console.log(`Created ${file}`);
});

console.log('Done! Placeholder assets created.');
