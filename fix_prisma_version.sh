#!/bin/bash

echo "[🔧] Ripping out Prisma v7 and installing stable v5..."

# 1. Uninstall the breaking v7 packages
npm uninstall prisma @prisma/client

# 2. Install the stable v5 version strictly
npm install @prisma/client@5
npm install prisma@5 --save-dev

# 3. Rewrite the FULL schema.prisma file for absolute certainty
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
  
  @@index([organizationId])
}
SCHEMA

# 4. Generate the Client (This will actually work now)
echo "[🔧] Generating fresh Prisma schema definitions for v5..."
npx prisma generate

# 5. Re-run the Day 5 audit
echo "[🔒] Re-running automated network audit..."
npx ts-node src/test_day5.ts
