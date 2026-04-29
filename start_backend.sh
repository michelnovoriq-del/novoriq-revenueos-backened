#!/bin/bash

echo "[🔧] Wiring 'dev' command into package.json..."

node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
pkg.scripts = pkg.scripts || {};
pkg.scripts.dev = 'ts-node src/index.ts';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

echo "[🚀] Booting Novoriq Backend Engine..."
npm run dev
