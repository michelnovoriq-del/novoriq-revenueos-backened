#!/bin/bash

echo "[🔧] Forcing Prisma to build TypeScript definitions..."
npx prisma generate

echo "[✅] Definitions generated. Re-running the network audit..."
npx ts-node src/test_day5.ts
