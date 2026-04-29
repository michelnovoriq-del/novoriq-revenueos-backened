#!/bin/bash

echo "[🚀] Initiating Day 4: Database Indexing & Seeding..."

# 1. Update Schema with Performance Indexes
cat << 'SCHEMA' > prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Organization {
  id                 String    @id @default(uuid())
  name               String
  
  whopSubscriptionId String?   @unique 
  tier               String    @default("INACTIVE") 
  accessExpiresAt    DateTime? 
  
  encryptedStripeKey String?
  stripeKeyIv        String?   
  
  users              User[]
  payments           Payment[]
  disputes           Dispute[]
  
  createdAt          DateTime  @default(now())
}

model User {
  id             String       @id @default(uuid())
  email          String       @unique
  passwordHash   String
  role           String       @default("ADMIN")
  
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  createdAt      DateTime     @default(now())
  
  // Performance Index
  @@index([organizationId])
}

model Payment {
  id             String       @id @default(uuid())
  stripeChargeId String       @unique
  amount         Int          
  status         String       
  
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  disputes       Dispute[]
  createdAt      DateTime     @default(now())
  
  // Performance Index
  @@index([organizationId])
}

model Dispute {
  id             String       @id @default(uuid())
  stripeId       String       @unique
  reason         String       
  status         String       
  evidencePdfUrl String?      
  
  paymentId      String
  payment        Payment      @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  createdAt      DateTime     @default(now())
  
  // Performance Index
  @@index([organizationId])
}
SCHEMA

echo "[✅] Indexes added to Schema. Executing PostgreSQL migration..."
npx prisma migrate dev --name add_tenant_indexes

# 2. Create the Seed Script
cat << 'SEED' > prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log("\n[🌱] Seeding the database with test data...");

  // Clear existing data to prevent duplicates during testing
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // Create a master test organization
  const org = await prisma.organization.create({
    data: {
      name: "Novoriq Alpha Testers",
      tier: "PRO", // Bypasses the paywall for testing
    }
  });

  // Create a securely hashed password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash("admin123!", salt);

  // Create the Admin user attached to the organization
  const user = await prisma.user.create({
    data: {
      email: "admin@novoriq.local",
      passwordHash: hashedPassword,
      role: "ADMIN",
      organizationId: org.id
    }
  });

  console.log(`[✅] Organization created: ${org.name} (ID: ${org.id})`);
  console.log(`[✅] User created: ${user.email} (Org ID: ${user.organizationId})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
SEED

# 3. Add the seed command to package.json (using a quick Node script to modify it)
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json'));
pkg.prisma = { seed: 'ts-node prisma/seed.ts' };
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

echo "[✅] Seed script configured. Running seed..."
npx prisma db seed

echo "[🔥] Day 4 complete! Database indexed and seeded."
