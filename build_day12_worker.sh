#!/bin/bash

echo "[🚀] Initiating Day 12: Background Worker & Queue Architecture..."

# 1. Update Schema to include processing status
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
  
  // QUEUE FIELDS
  processingStatus String     @default("PENDING") // PENDING, PROCESSING, COMPLETED, FAILED
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

npx prisma migrate dev --name add_queue_status

# 2. Build the Worker Service
cat << 'CODE' > src/services/worker.ts
import { PrismaClient } from '@prisma/client';
import { generateCompellingEvidence } from './pdfService';

const prisma = new PrismaClient();

export const processQueue = async () => {
    // Find the oldest pending dispute
    const dispute = await prisma.dispute.findFirst({
        where: { processingStatus: 'PENDING' },
        include: { payment: true, organization: true },
        orderBy: { createdAt: 'asc' }
    });

    if (!dispute) return;

    console.log(`[⚙️] Worker: Processing Dispute ${dispute.stripeId}...`);

    try {
        // Mark as processing to prevent other workers from grabbing it
        await prisma.dispute.update({
            where: { id: dispute.id },
            data: { processingStatus: 'PROCESSING' }
        });

        const pdfPath = await generateCompellingEvidence({
            disputeId: dispute.stripeId,
            chargeId: dispute.payment.stripeChargeId,
            amount: dispute.payment.amount,
            reason: dispute.reason,
            date: dispute.payment.createdAt.toISOString().split('T')[0],
            organizationName: dispute.organization.name
        });

        await prisma.dispute.update({
            where: { id: dispute.id },
            data: { 
                evidencePdfUrl: pdfPath,
                processingStatus: 'COMPLETED'
            }
        });

        console.log(`[✅] Worker: Successfully generated PDF for ${dispute.stripeId}`);
    } catch (error) {
        console.error(`[❌] Worker: Failed ${dispute.stripeId}`, error);
        await prisma.dispute.update({
            where: { id: dispute.id },
            data: { processingStatus: 'FAILED' }
        });
    }
};

// Polling interval: Check every 5 seconds
setInterval(processQueue, 5000);
console.log("[🚀] Novoriq Worker initialized and polling for tasks...");
CODE

# 3. Rewrite Stripe Webhook to be "Queue-Only"
cat << 'CODE' > src/webhooks/stripeWebhook.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
    const orgId = req.params.organizationId;
    if (!orgId || typeof orgId !== 'string') {
        res.status(400).json({ error: 'Invalid Org ID.' });
        return;
    }
    
    try {
        const payloadString = req.body.toString('utf8');
        const event = JSON.parse(payloadString);

        if (event.type === 'charge.dispute.created') {
            const dispute = event.data.object;
            const payment = await prisma.payment.findUnique({ where: { stripeChargeId: dispute.charge } });
            
            if (payment) {
                await prisma.dispute.create({
                    data: {
                        stripeId: dispute.id,
                        reason: dispute.reason,
                        status: 'needs_response',
                        processingStatus: 'PENDING', // This triggers the worker
                        paymentId: payment.id,
                        organizationId: orgId
                    }
                });
                console.log(`[📥] Webhook: Dispute ${dispute.id} added to processing queue.`);
            }
        }
        res.status(200).json({ received: true });
    } catch (error) {
        res.status(400).send("Webhook Error");
    }
};
CODE

# 4. Build the Simulation
cat << 'TEST' > src/test_day12.ts
import { PrismaClient } from '@prisma/client';
import { server } from './index';
import { processQueue } from './services/worker';

const prisma = new PrismaClient();

async function runAudit() {
    console.log("\n[🔒] Running Worker Queue Simulation...\n");

    try {
        const org = await prisma.organization.findFirst();
        const mockChargeId = `ch_worker_${Date.now()}`;
        const mockStripeId = `dp_worker_${Date.now()}`;

        await prisma.payment.create({
            data: { stripeChargeId: mockChargeId, amount: 5000, status: 'succeeded', organizationId: org!.id }
        });

        // Fire webhook
        await fetch(`http://localhost:3000/api/webhooks/stripe/${org!.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'charge.dispute.created', data: { object: { id: mockStripeId, charge: mockChargeId, reason: 'fraudulent' } } })
        });

        console.log("-> Webhook fired. Checking database for PENDING status...");
        const pending = await prisma.dispute.findUnique({ where: { stripeId: mockStripeId } });
        console.log(`   Status: ${pending?.processingStatus}`);

        console.log("-> Manually triggering Worker cycle...");
        await processQueue();

        const completed = await prisma.dispute.findUnique({ where: { stripeId: mockStripeId } });
        console.log(`   Final Status: ${completed?.processingStatus}`);
        console.log(`   PDF URL: ${completed?.evidencePdfUrl ? 'VALID' : 'MISSING'}`);

    } catch (err) {
        console.error(err);
    } finally {
        server.close();
        process.exit(0);
    }
}

setTimeout(runAudit, 1000);
