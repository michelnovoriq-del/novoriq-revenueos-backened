#!/bin/bash

echo "[🚀] Initiating Day 8: Stripe Event Ingestion Architecture..."

# 1. Build the Stripe Webhook Controller
cat << 'CODE' > src/webhooks/stripeWebhook.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
    const orgId = req.params.organizationId;
    
    try {
        // Stripe strictly requires the RAW body buffer for signature verification in production.
        // req.body is a Buffer here because of our strict routing rules in index.ts.
        const payloadString = req.body.toString('utf8');
        const event = JSON.parse(payloadString);

        if (event.type === 'charge.dispute.created') {
            const dispute = event.data.object;
            const chargeId = dispute.charge;
            const reason = dispute.reason;

            console.log(`\n[⚡] STRIPE EVENT INGESTED: Dispute created for charge ${chargeId}`);
            console.log(`     Reason: ${reason}`);

            // Ensure the payment exists in our database before mapping the dispute
            const payment = await prisma.payment.findUnique({ where: { stripeChargeId: chargeId } });
            
            if (payment) {
                // Log the dispute securely mapped to the correct tenant
                await prisma.dispute.create({
                    data: {
                        stripeId: dispute.id,
                        reason: reason,
                        status: 'needs_response',
                        paymentId: payment.id,
                        organizationId: orgId
                    }
                });
                console.log(`[✅] Dispute ${dispute.id} securely locked into tenant vault.`);
            } else {
                console.log(`[⚠️] Security Warning: Charge ${chargeId} not found in database.`);
            }
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error("[CRITICAL] Stripe Webhook parsing failed:", error);
        res.status(400).send(`Webhook Error: ${(error as Error).message}`);
    }
};
CODE

# 2. Build the Stripe Webhook Routes
cat << 'CODE' > src/routes/stripeRoutes.ts
import { Router } from 'express';
import { handleStripeWebhook } from '../webhooks/stripeWebhook';

const router = Router();

// Multi-tenant endpoint: Captures the organization ID directly from the URL
router.post('/:organizationId', handleStripeWebhook);

export default router;
CODE

# 3. Rewrite index.ts for strict architectural parsing
cat << 'CODE' > src/index.ts
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import orgRoutes from './routes/orgRoutes';
import webhookRoutes from './routes/webhookRoutes';
import stripeRoutes from './routes/stripeRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet()); 
app.use(cors({ origin: 'http://localhost:3000' }));

// ==========================================
// STRICT ROUTING ARCHITECTURE
// ==========================================

// 1. STRIPE BYPASS: Must remain raw unparsed Buffer
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeRoutes);

// 2. STANDARD PARSING: Converts payload to JSON for all other routes
app.use(express.json());

// 3. STANDARD ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/organizations', orgRoutes);
app.use('/api/webhooks/whop', webhookRoutes);

app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'Novoriq OS is running securely.' });
});

export const server = app.listen(PORT, () => {
    console.log(`[🚀] Server running on port ${PORT}`);
});
CODE

# 4. Build the Automated Simulation Script
cat << 'TEST' > src/test_day8.ts
import { PrismaClient } from '@prisma/client';
import { server } from './index';

const prisma = new PrismaClient();

async function runAudit() {
    console.log("\n[🔒] Running Stripe Event Ingestion Audit...\n");

    try {
        const org = await prisma.organization.findFirst();
        if (!org) throw new Error("No test organization found.");

        // 1. Prepare Database: Inject a dummy successful payment
        const mockChargeId = `ch_test_${Date.now()}`;
        const payment = await prisma.payment.create({
            data: {
                stripeChargeId: mockChargeId,
                amount: 9900, // $99.00
                status: 'succeeded',
                organizationId: org.id
            }
        });
        console.log(`-> 1. Payment Database Seeded: ${mockChargeId}`);

        // 2. Simulate the exact JSON structure of a Stripe 'charge.dispute.created' event
        const mockStripeId = `dp_test_${Date.now()}`;
        const stripePayload = {
            id: "evt_test_123",
            type: "charge.dispute.created",
            data: {
                object: {
                    id: mockStripeId,
                    charge: mockChargeId,
                    reason: "fraudulent",
                    status: "needs_response"
                }
            }
        };

        // 3. Fire the payload at the RAW endpoint
        console.log(`-> 2. Firing RAW Stripe payload to /api/webhooks/stripe/${org.id}...`);
        const res = await fetch(`http://localhost:3000/api/webhooks/stripe/${org.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stripePayload) // sent as string, received as raw buffer
        });

        if (!res.ok) throw new Error("Webhook rejected.");

        // 4. Verify the dispute was written to PostgreSQL
        const dispute = await prisma.dispute.findUnique({ where: { stripeId: mockStripeId } });
        
        if (dispute && dispute.organizationId === org.id) {
            console.log(`\n[✅] SUCCESS: Engine successfully caught and mapped the Stripe dispute.`);
            console.log(`     Dispute ID: ${dispute.id}`);
        } else {
            console.log("\n[❌] FAILURE: Dispute was not found in the database.");
        }

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

echo "[✅] Controllers, Routes, and Architecture built. Executing Simulation..."
npx ts-node src/test_day8.ts
