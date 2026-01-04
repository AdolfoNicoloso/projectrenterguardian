#!/usr/bin/env node

/**
 * Verifies that the project is set up correctly
 */

const fs = require('fs');
const path = require('path');

let hasErrors = false;
let hasWarnings = false;

console.log('🔍 Verifying Project Renter Guardian setup...\n');

// Check .env file
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('EXPO_PUBLIC_DIRECTUS_URL')) {
      const urlMatch = envContent.match(/EXPO_PUBLIC_DIRECTUS_URL=(.+)/);
      if (urlMatch && urlMatch[1] && !urlMatch[1].includes('your-directus-instance')) {
        console.log('✅ .env file configured with Directus URL');
      } else {
        console.log('⚠️  .env file exists but Directus URL not configured (will use mock mode)');
        hasWarnings = true;
      }
    } else {
      console.log('⚠️  .env file exists but missing EXPO_PUBLIC_DIRECTUS_URL (will use mock mode)');
      hasWarnings = true;
    }
  } catch (error) {
    // .env file exists but can't be read (might be protected)
    console.log('✅ .env file exists (protected, cannot verify contents)');
  }
} else {
  console.log('⚠️  .env file not found (will use mock mode)');
  hasWarnings = true;
}

// Check assets
const assetsDir = path.join(__dirname, '..', 'assets');
const requiredAssets = ['icon.png', 'splash.png', 'adaptive-icon.png', 'favicon.png'];
const missingAssets = [];

requiredAssets.forEach(asset => {
  const assetPath = path.join(assetsDir, asset);
  if (fs.existsSync(assetPath)) {
    console.log(`✅ ${asset} found`);
  } else {
    console.log(`⚠️  ${asset} missing`);
    missingAssets.push(asset);
    hasWarnings = true;
  }
});

// Check node_modules
const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('✅ node_modules installed');
} else {
  console.log('❌ node_modules not found - run "npm install"');
  hasErrors = true;
}

// Check key files
const keyFiles = [
  'package.json',
  'app.json',
  'tsconfig.json',
  'babel.config.js',
  'src/services/directus.ts',
  'app/_layout.tsx',
];

keyFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.log(`❌ ${file} missing`);
    hasErrors = true;
  }
});

console.log('\n' + '='.repeat(50));

if (hasErrors) {
  console.log('\n❌ Setup incomplete - please fix the errors above');
  process.exit(1);
} else if (hasWarnings) {
  console.log('\n⚠️  Setup complete with warnings');
  if (missingAssets.length > 0) {
    console.log('\nTo create placeholder assets, run:');
    console.log('  npm run setup-assets');
  }
  console.log('\nYou can start development with:');
  console.log('  npm start');
  process.exit(0);
} else {
  console.log('\n✅ Setup complete! All checks passed.');
  console.log('\nYou can start development with:');
  console.log('  npm start');
  process.exit(0);
}

