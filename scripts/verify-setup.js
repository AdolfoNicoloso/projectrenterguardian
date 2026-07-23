#!/usr/bin/env node
/**
 * Verifies Project Renter Guardian local setup (Firebase + Expo).
 */

const fs = require('fs');
const path = require('path');

let hasErrors = false;
let hasWarnings = false;

console.log('Verifying Project Renter Guardian setup...\n');

const envPath = path.join(__dirname, '..', '.env');
const requiredFirebaseVars = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
];

if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const missing = requiredFirebaseVars.filter((key) => {
      const re = new RegExp(`^${key}=(.+)$`, 'm');
      const m = envContent.match(re);
      return !m || !m[1] || m[1].includes('your-');
    });
    if (missing.length === 0) {
      console.log('OK  .env has required EXPO_PUBLIC_FIREBASE_* vars');
    } else {
      console.log('WARN missing or placeholder Firebase env vars:', missing.join(', '));
      hasWarnings = true;
    }
    if (envContent.includes('EXPO_PUBLIC_DIRECTUS_URL')) {
      console.log('WARN EXPO_PUBLIC_DIRECTUS_URL is obsolete; remove it from .env');
      hasWarnings = true;
    }
  } catch {
    console.log('OK  .env exists (could not read contents)');
  }
} else {
  console.log('WARN .env not found — copy Firebase web config into a root .env');
  hasWarnings = true;
}

const assetsDir = path.join(__dirname, '..', 'assets');
const requiredAssets = ['icon.png', 'splash.png', 'adaptive-icon.png', 'favicon.png'];
requiredAssets.forEach((asset) => {
  if (fs.existsSync(path.join(assetsDir, asset))) {
    console.log(`OK  assets/${asset}`);
  } else {
    console.log(`WARN missing assets/${asset}`);
    hasWarnings = true;
  }
});

if (fs.existsSync(path.join(__dirname, '..', 'node_modules'))) {
  console.log('OK  node_modules installed');
} else {
  console.log('ERR node_modules missing — run npm install');
  hasErrors = true;
}

const keyFiles = [
  'package.json',
  'app.json',
  'tsconfig.json',
  'babel.config.js',
  'src/services/backendClient.ts',
  'src/services/firebase.ts',
  'functions/src/index.ts',
  'functions/src/firestore/index.ts',
  'app/_layout.tsx',
];

keyFiles.forEach((file) => {
  if (fs.existsSync(path.join(__dirname, '..', file))) {
    console.log(`OK  ${file}`);
  } else {
    console.log(`ERR missing ${file}`);
    hasErrors = true;
  }
});

console.log('');
if (hasErrors) {
  console.log('Setup has errors.');
  process.exit(1);
}
if (hasWarnings) {
  console.log('Setup OK with warnings.');
  process.exit(0);
}
console.log('Setup looks good.');
process.exit(0);
