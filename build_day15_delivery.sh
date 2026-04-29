#!/bin/bash

echo "[🚀] Initiating Day 15: Asset Delivery & Golden Trio Ingestion..."

# 1. Update Stripe Webhook to capture Golden Trio and IP-API location
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

        // 1. INGEST GOLDEN TRIO ON PURCHASE
        if (event.type === 'charge.succeeded') {
            const charge = event.data.object;
            const ip = charge.metadata?.customer_ip || null;
            const fingerprint = charge.metadata?.device_fingerprint || null;
            let location = null;

            // Fetch physical location from IP-API
            if (ip) {
                try {
                    const locRes = await fetch(`http://ip-api.com/json/${ip}`);
                    const locData = await locRes.json();
                    if (locData.status === 'success') {
                        location = `${locData.city}, ${locData.country}`;
                    }
                } catch (e) { console.error("IP-API resolution failed"); }
            }

            // Save the payment with the Golden Trio intel
            await prisma.payment.upsert({
                where: { stripeChargeId: charge.id },
                update: { customerIp: ip, deviceFingerprint: fingerprint, location },
                create: {
                    stripeChargeId: charge.id,
                    amount: charge.amount,
                    status: charge.status,
                    organizationId: orgId,
                    customerIp: ip,
                    deviceFingerprint: fingerprint,
                    location
                }
            });
            console.log(`[🌐] Golden Trio Intel Secured for charge ${charge.id}. Location: ${location}`);
        }

        // 2. QUEUE DISPUTE FOR PDF FACTORY
        if (event.type === 'charge.dispute.created') {
            const dispute = event.data.object;
            const payment = await prisma.payment.findUnique({ where: { stripeChargeId: dispute.charge } });
            
            if (payment) {
                await prisma.dispute.create({
                    data: {
                        stripeId: dispute.id,
                        reason: dispute.reason,
                        status: 'needs_response',
                        processingStatus: 'PENDING',
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

# 2. Add PDF Download Route to Dashboard Controller
cat << 'CODE' > src/controllers/dashboardController.ts
import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { encryptStripeKey } from '../utils/encryption';
import { verifyStripeConnection } from '../services/stripeService';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

export const connectStripeKey = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const orgId = req.user?.organizationId;
        const { stripeSecretKey } = req.body;
        if (!stripeSecretKey || !stripeSecretKey.startsWith('sk_')) {
            res.status(400).json({ error: "Invalid Stripe Secret Key format." }); return;
        }
        const { encryptedStripeKey, stripeKeyIv } = encryptStripeKey(stripeSecretKey);
        await prisma.organization.update({ where: { id: orgId }, data: { encryptedStripeKey, stripeKeyIv } });
        const isValid = await verifyStripeConnection(orgId as string);
        if (isValid) { res.json({ success: true, message: "[✅] Stripe connection verified." }); } 
        else { res.status(400).json({ error: "Key failed Stripe verification." }); }
    } catch (error) { res.status(500).json({ error: "Failed to secure keys." }); }
};

export const getMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const orgId = req.user?.organizationId;
        const org = await prisma.organization.findUnique({ where: { id: orgId } });
        const totalDisputes = await prisma.dispute.count({ where: { organizationId: orgId } });
        res.json({
            metrics: {
                totalDisputes,
                revenueRecoveredFormatted: `$${(org!.revenueRecovered / 100).toFixed(2)}`,
                performanceFeeOwedFormatted: `$${(org!.performanceFeeOwed / 100).toFixed(2)}`,
                pdfsGenerated: org?.pdfsGenerated,
                pdfLimit: org?.tier === 'TRIAL' ? 3 : 'Unlimited'
            }
        });
    } catch (error) { res.status(500).json({ error: "Metrics error." }); }
};

export const getDisputes = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const orgId = req.user?.organizationId;
        const disputes = await prisma.dispute.findMany({ 
            where: { organizationId: orgId }, include: { payment: true }, orderBy: { createdAt: 'desc' }, take: 50 
        });
        res.json({ disputes });
    } catch (error) { res.status(500).json({ error: "Failed to fetch ledger." }); }
};

// NEW: SECURE PDF DOWNLOAD ENDPOINT
export const downloadEvidencePdf = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const orgId = req.user?.organizationId;
        const disputeId = req.params.id;

        const dispute = await prisma.dispute.findFirst({
            where: { id: disputeId, organizationId: orgId }
        });

        if (!dispute || !dispute.evidencePdfUrl) {
            res.status(404).json({ error: "Evidence PDF not found or still processing." });
            return;
        }

        const filePath = path.resolve(dispute.evidencePdfUrl);
        if (fs.existsSync(filePath)) {
            // Securely stream the file to the client's browser
            res.download(filePath, `Novoriq_Evidence_${dispute.stripeId}.pdf`);
        } else {
            res.status(404).json({ error: "File missing from disk." });
        }
    } catch (error) {
        res.status(500).json({ error: "Server error during file transmission." });
    }
};
CODE

# 3. Update Dashboard Routes
cat << 'CODE' > src/routes/dashboardRoutes.ts
import { Router } from 'express';
import { connectStripeKey, getMetrics, getDisputes, downloadEvidencePdf } from '../controllers/dashboardController';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.post('/keys', requireAuth, connectStripeKey);
router.get('/metrics', requireAuth, getMetrics);
router.get('/disputes', requireAuth, getDisputes);
router.get('/disputes/:id/pdf', requireAuth, downloadEvidencePdf);

export default router;
CODE

# 4. Build End-to-End Simulation
cat << 'TEST' > src/test_day15.ts
import { PrismaClient } from '@prisma/client';
import { server } from './index';
import { processQueue } from './services/worker';

const prisma = new PrismaClient();

async function runAudit() {
    console.log("\n[🔒] Running Golden Trio & Asset Delivery Audit...\n");

    try {
        const org = await prisma.organization.findFirst();
        const mockChargeId = `ch_trio_${Date.now()}`;
        const mockStripeId = `dp_trio_${Date.now()}`;

        // 1. Simulate Charge Succeeded Webhook (with Golden Trio Metadata)
        console.log("-> 1. Firing charge.succeeded webhook (Google DNS IP injected)...");
        await fetch(`http://localhost:3000/api/webhooks/stripe/${org!.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                type: 'charge.succeeded', 
                data: { object: { 
                    id: mockChargeId, amount: 9900, status: 'succeeded', 
                    metadata: { customer_ip: '8.8.8.8', device_fingerprint: 'fp_a1b2c3d4' } 
                }} 
            })
        });

        // Give IP-API a moment to resolve
        await new Promise(r => setTimeout(r, 1500));

        // 2. Simulate Dispute Created Webhook
        console.log("-> 2. Firing charge.dispute.created webhook...");
        await fetch(`http://localhost:3000/api/webhooks/stripe/${org!.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                type: 'charge.dispute.created', 
                data: { object: { id: mockStripeId, charge: mockChargeId, reason: 'unrecognized' } } 
            })
        });

        // 3. Process PDF via Worker
        console.log("-> 3. Triggering Worker to compile Evidence PDF...");
        await processQueue();

        const dispute = await prisma.dispute.findUnique({ where: { stripeId: mockStripeId } });
        
        // 4. Test Secure Download Route
        console.log("-> 4. Testing Secure PDF Download Route...");
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@novoriq.local', password: 'admin123!' })
        });
        const { token } = await loginRes.json();

        const downloadRes = await fetch(`http://localhost:3000/api/dashboard/disputes/${dispute!.id}/pdf`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (downloadRes.ok) {
            const contentType = downloadRes.headers.get('content-type');
            console.log(`[✅] Asset Delivery Confirmed. Received content type: ${contentType}`);
        } else {
            throw new Error("Download route rejected the request.");
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

echo "[✅] Delivery Pipeline Built. Executing Simulation..."
npx ts-node src/test_day15.ts
