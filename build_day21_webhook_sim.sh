#!/bin/bash

echo "[🚀] Initiating Day 21: Whop Webhook Wiring & Payment Simulation..."

# 1. Ensure the webhook route is perfectly wired to the handler
cat << 'CODE' > src/routes/webhookRoutes.ts
import { Router } from 'express';
import { handleWhopWebhook } from '../webhooks/whopWebhook';

const router = Router();

// Whop sends POST requests here
router.post('/', handleWhopWebhook);

export default router;
CODE

# 2. Build the Whop Payment Simulator
cat << 'TEST' > src/simulate_payment.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function simulatePayment() {
    console.log("\n[💳] Simulating Whop Payment Webhook...");

    try {
        // 1. Get your test account's exact Organization ID
        const org = await prisma.organization.findFirst();
        if (!org) throw new Error("No organization found to upgrade.");

        console.log(`-> Target Organization ID: ${org.id}`);
        console.log(`-> Current Tier: ${org.tier}`);

        // 2. Construct the exact payload Whop sends after a $10 checkout
        const whopPayload = {
            action: 'membership.went_valid',
            data: {
                id: `sub_test_${Date.now()}`,
                plan: {
                    id: 'plan_g5k8i3tfPkASV' // Your $10 48-Hour Trial Plan ID
                },
                metadata: {
                    organizationId: org.id // The ID we passed in the checkout URL
                }
            }
        };

        // 3. Fire the webhook at our own backend
        console.log("-> Firing webhook to http://localhost:3000/api/webhooks/whop ...");
        const response = await fetch('http://localhost:3000/api/webhooks/whop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(whopPayload)
        });

        if (response.ok) {
            console.log("[✅] Webhook Accepted by Backend Engine.");
            
            // 4. Verify the database actually updated
            const updatedOrg = await prisma.organization.findUnique({ where: { id: org.id } });
            console.log(`[🎉] Organization upgraded to: ${updatedOrg?.tier}`);
            console.log(`[⏳] Expiration Set For: ${updatedOrg?.accessExpiresAt}`);
        } else {
            console.error("[❌] Backend rejected the webhook. Is the backend running on port 3000?");
        }

    } catch (err) {
        console.error("Simulation Failed:", err);
    } finally {
        await prisma.$disconnect();
    }
}

simulatePayment();
TEST

echo "[✅] Simulator Built. Firing simulated payment..."
npx ts-node src/simulate_payment.ts
