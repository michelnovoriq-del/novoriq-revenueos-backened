#!/bin/bash

echo "[🧹] Initiating hard reset of Node modules and Prisma cache..."

# 1. Nuke the corrupted cache and lockfile
rm -rf node_modules package-lock.json

# 2. Reinstall core dependencies 
echo "[📦] Reinstalling production dependencies..."
npm install express dotenv stripe puppeteer jsonwebtoken bcrypt cors helmet
npm install @prisma/client@latest

# 3. Reinstall development dependencies (Forcing matching Prisma version)
echo "[📦] Reinstalling development dependencies..."
npm install typescript ts-node @types/node @types/express @types/cors @types/jsonwebtoken @types/bcrypt prisma@latest --save-dev

# 4. Generate the fresh Prisma Client dictionary
echo "[🔧] Generating fresh Prisma schema definitions..."
npx prisma generate

# 5. Run the Day 5 audit test
echo "[🔒] Re-running automated network audit..."
npx ts-node src/test_day5.ts

