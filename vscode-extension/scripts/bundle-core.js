#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const EXTENSION = path.join(__dirname, '..');
const CORE_DEST = path.join(EXTENSION, 'core');

// Directories to copy
const COPY_DIRS = [
    'dist/src',
    'dist/cli',
    'wiki/standards',
    'node_modules'
];

// Files to copy
const COPY_FILES = [
    'package.json'
];

// Clean and create destination
if (fs.existsSync(CORE_DEST)) {
    fs.rmSync(CORE_DEST, { recursive: true });
}
fs.mkdirSync(CORE_DEST, { recursive: true });

// Copy function
function copyRecursive(src, dest) {
    if (!fs.existsSync(src)) {
        console.warn(`Warning: ${src} does not exist, skipping...`);
        return;
    }

    const stat = fs.statSync(src);

    if (stat.isDirectory()) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }

        const files = fs.readdirSync(src);
        for (const file of files) {
            copyRecursive(
                path.join(src, file),
                path.join(dest, file)
            );
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}

// Copy each directory
console.log('Bundling core services into extension...');

for (const dir of COPY_DIRS) {
    const src = path.join(ROOT, dir);
    const dest = path.join(CORE_DEST, dir);

    console.log(`  Copying ${dir}...`);
    copyRecursive(src, dest);
}

// Copy individual files
for (const file of COPY_FILES) {
    const src = path.join(ROOT, file);
    const dest = path.join(CORE_DEST, file);

    console.log(`  Copying ${file}...`);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
    }
}

console.log('Core services bundled successfully!');
console.log(`  Location: ${CORE_DEST}`);
