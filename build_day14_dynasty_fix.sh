#!/bin/bash

echo "[🚀] Initiating Day 14: Jade Dynasty Core Expansion..."

# 1. Update Schema for Limits, Fees, and IP Intel
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
  
  // Performance & Tracking
  revenueRecovered   Int       @default(0) 
  performanceFeeOwed Int       @default(0) 
  pdfsGenerated      Int       @default(0)
  
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
  role           String       @default("USER") 
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
  
  // Fingerprint & IP Data (The Golden Trio)
  customerIp     String?
  deviceFingerprint String?
  location       String?
  
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
  processingStatus String     @default("PENDING")
  evidencePdfUrl String?      
  
  paymentId      String
  payment        Payment      @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  createdAt      DateTime     @default(now())
  @@index([organizationId])
  @@index([processingStatus])
}
SCHEMA

echo "[🔧] Pushing Jade Dynasty Schema..."
npx prisma db push

# 2. Build the Admin Controller (Master Control)
cat << 'CODE' > src/controllers/adminController.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const getAllOrganizations = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'ADMIN') {
            res.status(403).json({ error: "Access Denied. Emperor only." });
            return;
        }
        const orgs = await prisma.organization.findMany({
            include: { _count: { select: { disputes: true, users: true } } }
        });
        res.json({ organizations: orgs });
    } catch (error) {
        res.status(500).json({ error: "System fault." });
    }
};

export const markDisputeWon = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { disputeId } = req.body;
        const dispute = await prisma.dispute.findUnique({
            where: { id: disputeId },
            include: { payment: true }
        });

        if (dispute) {
            const fee = Math.round(dispute.payment.amount * 0.20); // 20% cut calculation
            await prisma.organization.update({
                where: { id: dispute.organizationId },
                data: {
                    revenueRecovered: { increment: dispute.payment.amount },
                    performanceFeeOwed: { increment: fee }
                }
            });
            await prisma.dispute.update({ where: { id: disputeId }, data: { status: 'won' } });
            res.json({ success: true, message: "Revenue recovered. Fees updated.", feeCalculated: fee });
        } else {
            res.status(404).json({ error: "Dispute not found." });
        }
    } catch (error) { res.status(500).json({ error: "Failed to update recovery state." }); }
};
CODE

# 3. Build Admin Routes
cat << 'CODE' > src/routes/adminRoutes.ts
import { Router } from 'express';
import { getAllOrganizations, markDisputeWon } from '../controllers/adminController';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.get('/organizations', requireAuth, getAllOrganizations);
router.post('/resolve-won', requireAuth, markDisputeWon);

export default router;
CODE

# 4. Update index.ts to include Admin routes
cat << 'CODE' > src/index.ts
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import orgRoutes from './routes/orgRoutes';
import webhookRoutes from './routes/webhookRoutes';
import stripeRoutes from './routes/stripeRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import adminRoutes from './routes/adminRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet()); 
app.use(cors({ origin: 'http://localhost:3000' }));

app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeRoutes);

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/organizations', orgRoutes);
app.use('/api/webhooks/whop', webhookRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'Jade Dynasty Engine Online.' });
});

export const server = app.listen(PORT, () => {
    console.log(`[🚀] Server running on port ${PORT}`);
});
CODE

# 5. Build Day 14 Simulation (Performance Fee Engine Test)
cat << 'TEST' > src/test_day14.ts
import { PrismaClient } from '@prisma/client';
import { server } from './index';

const prisma = new PrismaClient();

async function runAudit() {
    console.log("\n[🔒] Running Jade Dynasty Performance Fee Audit...\n");

    try {
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@novoriq.local', password: 'admin123!' })
        });
        const { token } = await loginRes.json();

        // Find a dispute to resolve
        const dispute = await prisma.dispute.findFirst();
        if (!dispute) throw new Error("No disputes found to test.");

        console.log(`-> 1. Marking Dispute ${dispute.id} as WON...`);
        const resolveRes = await fetch('http://localhost:3000/api/admin/resolve-won', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ disputeId: dispute.id })
        });
        
        const resolveData = await resolveRes.json();
        console.log(`[✅] Action: ${resolveData.message}`);
        console.log(`[💰] System calculated a performance fee of: $${(resolveData.feeCalculated / 100).toFixed(2)} USD`);

        console.log("\n-> 2. Verifying Organization Metrics update...");
        const org = await prisma.organization.findUnique({ where: { id: dispute.organizationId } });
        console.log(`[✅] Total Revenue Recovered: $${(org!.revenueRecovered / 100).toFixed(2)} USD`);
        console.log(`[✅] Total Performance Fees Owed to you: $${(org!.performanceFeeOwed / 100).toFixed(2)} USD`);

    } catch (err) {
        console.error("\n[❌] Audit Failed:", err);
    } finally {
        await prisma.$disconnect();
        server.close();
        process.exit(0);
    }
}

setTimeout(runAudit, 1000);
TEST

echo "[✅] Jade Dynasty Core logic deployed. Executing simulation..."
npx ts-node src/test_day14.ts
