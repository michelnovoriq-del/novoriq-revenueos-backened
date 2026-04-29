#!/bin/bash

echo "[🔧] Engineering correction: Hard-resetting local PostgreSQL credentials..."

# 1. Force the password reset at the Linux system level
echo "-> Bypassing peer authentication. Please enter your computer's password if prompted by sudo:"
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'NovoriqAdmin2026';"

# 2. Use Node.js to safely rewrite the DATABASE_URL in the .env file without regex/sed breaking
node -e "
const fs = require('fs');
const envPath = '.env';
if (fs.existsSync(envPath)) {
    let envFile = fs.readFileSync(envPath, 'utf8');
    envFile = envFile.replace(/^DATABASE_URL=.*$/m, 'DATABASE_URL=\"postgresql://postgres:NovoriqAdmin2026@localhost:5432/novoriq_db\"');
    fs.writeFileSync(envPath, envFile);
    console.log('[✅] Vault (.env) securely updated with new credentials.');
} else {
    console.error('[CRITICAL] .env file not found.');
    process.exit(1);
}
"

# 3. Force the database schema push (this will automatically create 'novoriq_db' if it doesn't exist yet)
echo "[🔧] Syncing Prisma schema with PostgreSQL..."
npx prisma db push

# 4. Re-seed the Admin user
echo "[🌱] Seeding multi-tenant test data..."
npx prisma db seed

# 5. Run the Day 5 Audit
echo "[🔒] Executing network audit..."
npx ts-node src/test_day5.ts
