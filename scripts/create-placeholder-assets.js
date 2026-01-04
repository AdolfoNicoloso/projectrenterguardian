#!/usr/bin/env node

/**
 * Creates placeholder asset files for development
 * Run this script if you don't have actual assets yet
 */

const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');

// Create assets directory if it doesn't exist
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Create a simple SVG placeholder that can be used for all assets
const placeholderSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="#6F00FF"/>
  <text x="512" y="512" font-family="Arial, sans-serif" font-size="200" fill="white" text-anchor="middle" dominant-baseline="middle">RG</text>
</svg>`;

console.log('Creating placeholder assets...');
console.log('Note: These are simple placeholders. Replace with actual assets before production.');

// For now, just create a README explaining what assets are needed
const readme = `# Assets Directory

This directory should contain the following files:

- **icon.png** (1024x1024) - App icon
- **splash.png** (1242x2436 recommended) - Splash screen image
- **adaptive-icon.png** (1024x1024) - Android adaptive icon
- **favicon.png** (48x48) - Web favicon

## Quick Setup

You can use any image editor or online tool to create these. For development, you can use placeholder images.

### Using ImageMagick (if installed):
\`\`\`bash
# Create a simple colored square as placeholder
convert -size 1024x1024 xc:#6F00FF -gravity center -pointsize 200 -fill white -annotate +0+0 "RG" icon.png
cp icon.png adaptive-icon.png
convert -size 1242x2436 xc:#191414 splash.png
convert -size 48x48 xc:#6F00FF favicon.png
\`\`\`

### Using Online Tools:
- Use https://www.favicon-generator.org/ for favicon
- Use any image editor for icons and splash screens
`;

fs.writeFileSync(path.join(assetsDir, 'README.md'), readme);

console.log('✓ Created assets/README.md with instructions');
console.log('\nNext steps:');
console.log('1. Add your actual asset files to the assets/ directory');
console.log('2. Or use placeholder images for development');
console.log('3. Run "npm start" to begin development');


