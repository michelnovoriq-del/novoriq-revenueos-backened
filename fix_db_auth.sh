#!/bin/bash

echo "[🔧] Engineering correction: Resolving PostgreSQL Authentication..."

# 1. Prompt for the correct database password securely (it will not show on screen as you type)
read -p "Enter your local PostgreSQL password for the user 'postgres': " -s PG_PASSWORD
echo ""

# 2. Update the .env file with the correct credentials using sed
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"postgresql://postgres:${PG_PASSWORD}@localhost:5432/novoriq_db\"|" .env
echo "[✅] Vault (.env) updated with valid database credentials."

# 3. Ensure the database has the latest schema pushed
npx prisma db push

# 4. Re-run the seed script to guarantee the admin@novoriq.local user exists
echo "[🌱] Verifying database seed..."
npx prisma db seed

# 5. Re-run the automated Day 5 network audit
echo "[🔒] Executing network audit..."
npx ts-node src/test_day5.ts
