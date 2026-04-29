#!/bin/bash

echo "[🚀] Injecting Multi-Tenant Prisma Schema..."

# 1. Overwrite the Prisma Schema
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
}
SCHEMA

echo "[✅] Schema written. Executing PostgreSQL migration..."

# 2. Run the migration to build the SQL tables
npx prisma migrate dev --name init_multi_tenant_vault

echo "[🔥] Day 1 Multi-Tenant Vault successfully built and migrated!"
