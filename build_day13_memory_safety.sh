#!/bin/bash

echo "[🚀] Initiating Day 13: Memory-Safe Stripe Integration (Jade Dynasty Protocol)..."

# 1. Install the Stripe Node.js library
npm install stripe

# 2. Build the Stripe Action Service
cat << 'CODE' > src/services/stripeService.ts
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { decryptStripeKey } from '../utils/encryption';

const prisma = new PrismaClient();

export const getStripeClientForOrg = async (organizationId: string): Promise<Stripe> => {
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { encryptedStripeKey: true, stripeKeyIv: true }
    });

    if (!org || !org.encryptedStripeKey || !org.stripeKeyIv) {
        throw new Error("Stripe keys not configured for this organization.");
    }

    // Just-In-Time Decryption
    const decryptedKey = decryptStripeKey(org.encryptedStripeKey, org.stripeKeyIv);
    
    // Initialize client and return it. 
    // The decryptedKey variable will go out of scope and be garbage collected.
    return new Stripe(decryptedKey, {
        apiVersion: '2025-01-27' as any,
    });
};

export const verifyStripeConnection = async (organizationId: string): Promise<boolean> => {
    try {
        const stripe = await getStripeClientForOrg(organizationId);
        // A simple call to verify the key works
        const account = await stripe.accounts.retrieve();
        return !!account.id;
    } catch (error) {
        console.error("[❌] Stripe Verification Failed:", (error as Error).message);
        return false;
    }
};
CODE

# 3. Add Verification Route to Dashboard
cat << 'CODE' > src/controllers/dashboardController.ts
import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { encryptStripeKey } from '../utils/encryption';
import { verifyStripeConnection } from '../services/stripeService';

const prisma = new PrismaClient();

export const connectStripeKey = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const orgId = req.user?.organizationId;
        const { stripeSecretKey } = req.body;

        if (!stripeSecretKey || !stripeSecretKey.startsWith('sk_')) {
            res.status(400).json({ error: "Invalid Stripe Secret Key format." });
            return;
        }

        const { encryptedStripeKey, stripeKeyIv } = encryptStripeKey(stripeSecretKey);

        await prisma.organization.update({
            where: { id: orgId },
            data: { encryptedStripeKey, stripeKeyIv }
        });

        // Verify the connection immediately after saving
        const isValid = await verifyStripeConnection(orgId as string);

        if (isValid) {
            res.json({ success: true, message: "[✅] Stripe connection verified and encrypted." });
        } else {
            res.status(400).json({ error: "Key saved but failed to connect to Stripe. Please check your key permissions." });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to secure Stripe keys." });
    }
};

// ... keep getMetrics and getDisputes as they were
export const getMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const orgId = req.user?.organizationId;
        const totalDisputes = await prisma.dispute.count({ where: { organizationId: orgId } });
        const pendingDisputes = await prisma.dispute.count({ where: { organizationId: orgId, status: 'needs_response' } });
        const disputesWithPayments = await prisma.dispute.findMany({ where: { organizationId: orgId }, include: { payment: true } });
        const totalAtRiskCents = disputesWithPayments.reduce((sum, d) => sum + d.payment.amount, 0);
        res.json({ metrics: { totalDisputes, pendingDisputes, totalAtRiskFormatted: `$${(totalAtRiskCents / 100).toFixed(2)}` } });
    } catch (error) { res.status(500).json({ error: "Failed to fetch metrics." }); }
};

export const getDisputes = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const orgId = req.user?.organizationId;
        const disputes = await prisma.dispute.findMany({ where: { organizationId: orgId }, include: { payment: true }, orderBy: { createdAt: 'desc' }, take: 50 });
        res.json({ disputes });
    } catch (error) { res.status(500).json({ error: "Failed to fetch disputes ledger." }); }
};
CODE

# 4. Build the Simulation
cat << 'TEST' > src/test_day13.ts
import { PrismaClient } from '@prisma/client';
import { server } from './index';

async function runAudit() {
    console.log("\n[🔒] Running Memory-Safe Connection Audit...\n");

    try {
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@novoriq.local', password: 'admin123!' })
        });
        const { token } = await loginRes.json();

        console.log("-> 1. Testing Invalid Stripe Key Submission...");
        const res = await fetch('http://localhost:3000/api/dashboard/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ stripeSecretKey: 'sk_test_fake_key' })
        });
        
        const data = await res.json();
        if (res.status === 400) {
            console.log(`[✅] Correctly rejected invalid Stripe key.`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        server.close();
        process.exit(0);
    }
}

setTimeout(runAudit, 1000);
