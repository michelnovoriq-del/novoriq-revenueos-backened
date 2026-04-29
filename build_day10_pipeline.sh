#!/bin/bash

echo "[🚀] Initiating Day 10: The End-to-End Automation Pipeline..."

# 1. Rewrite the Stripe Webhook Controller to trigger the PDF Factory
cat << 'CODE' > src/webhooks/stripeWebhook.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateCompellingEvidence } from '../services/pdfService';

const prisma = new PrismaClient();

export const handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
    const orgId = req.params.organizationId;
    
    if (!orgId || typeof orgId !== 'string') {
        res.status(400).json({ error: 'Invalid Organization ID.' });
        return;
    }
    
    try {
        const payloadString = req.body.toString('utf8');
        const event = JSON.parse(payloadString);

        if (event.type === 'charge.dispute.created') {
            const dispute = event.data.object;
            const chargeId = dispute.charge;
            const reason = dispute.reason;

            console.log(`\n[⚡] STRIPE EVENT: Dispute created for charge ${chargeId}`);

            // Fetch the payment AND the organization name for the PDF
            const payment = await prisma.payment.findUnique({ 
                where: { stripeChargeId: chargeId },
                include: { organization: true }
            });
            
            if (payment) {
                // 1. Log to Database
                const newDispute = await prisma.dispute.create({
                    data: {
                        stripeId: dispute.id,
                        reason: reason,
                        status: 'needs_response',
                        paymentId: payment.id,
                        organizationId: orgId
                    }
                });
                console.log(`[✅] Vault: Dispute ${dispute.id} logged.`);

                // 2. Trigger the PDF Factory asynchronously
                console.log(`[⚙️] Engine: Triggering PDF generation...`);
                try {
                    const pdfPath = await generateCompellingEvidence({
                        disputeId: newDispute.stripeId,
                        chargeId: payment.stripeChargeId,
                        amount: payment.amount,
                        reason: newDispute.reason,
                        date: payment.createdAt.toISOString().split('T')[0],
                        organizationName: payment.organization.name
                    });
                    
                    // 3. Update the database with the PDF file location
                    await prisma.dispute.update({
                        where: { id: newDispute.id },
                        data: { evidencePdfUrl: pdfPath }
                    });
                    
                    console.log(`[✅] Engine: Compelling Evidence PDF secured at ${pdfPath}`);
                } catch (pdfError) {
                    console.error("[⚠️] Engine Error: Failed to generate PDF.", pdfError);
                }

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

# 2. Build the End-to-End Simulation Script
cat << 'TEST' > src/test_day10.ts
import { PrismaClient } from '@prisma/client';
import { server } from './index';
import fs from 'fs';

const prisma = new PrismaClient();

async function runAudit() {
    console.log("\n[🔒] Running Full E2E Pipeline Simulation...\n");

    try {
        const org = await prisma.organization.findFirst();
        if (!org) throw new Error("No test organization found.");

        const uniqueSuffix = Date.now();
        const mockChargeId = `ch_live_${uniqueSuffix}`;
        const mockStripeId = `dp_live_${uniqueSuffix}`;

        // 1. Seed a payment
        await prisma.payment.create({
            data: {
                stripeChargeId: mockChargeId,
                amount: 14900, // $149.00
                status: 'succeeded',
                organizationId: org.id
            }
        });

        const stripePayload = {
            id: `evt_${uniqueSuffix}`,
            type: "charge.dispute.created",
            data: {
                object: {
                    id: mockStripeId,
                    charge: mockChargeId,
                    reason: "product_not_received",
                    status: "needs_response"
                }
            }
        };

        // 2. Fire the webhook
        console.log(`-> Firing Webhook to /api/webhooks/stripe/${org.id}...`);
        const res = await fetch(`http://localhost:3000/api/webhooks/stripe/${org.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stripePayload)
        });

        if (!res.ok) throw new Error("Webhook rejected.");

        // Wait 3 seconds to give Puppeteer time to render and save the PDF
        console.log("-> Awaiting Puppeteer rendering engine (3 seconds)...");
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 3. Verify Database and File System
        const finalDispute = await prisma.dispute.findUnique({ where: { stripeId: mockStripeId } });
        
        if (finalDispute && finalDispute.evidencePdfUrl) {
            if (fs.existsSync(finalDispute.evidencePdfUrl)) {
                console.log(`\n[✅] PIPELINE SUCCESS: Webhook received, database updated, and PDF verified on disk.`);
                console.log(`     Final File: ${finalDispute.evidencePdfUrl}`);
            } else {
                console.log("\n[❌] PIPELINE FAILURE: Database updated, but PDF file is missing from disk.");
            }
        } else {
            console.log("\n[❌] PIPELINE FAILURE: Dispute not logged or PDF URL not saved.");
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

echo "[✅] Pipeline connected. Executing End-to-End Simulation..."
npx ts-node src/test_day10.ts
