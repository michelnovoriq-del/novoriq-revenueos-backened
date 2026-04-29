#!/bin/bash

echo "[🔧] Restoring the full Dashboard Controller..."

cat << 'CODE' > src/controllers/dashboardController.ts
import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { encryptStripeKey } from '../utils/encryption';
import { verifyStripeConnection } from '../services/stripeService';

const prisma = new PrismaClient();

// 1. The Vault Connection (Day 11/13)
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

// 2. The Overview Metrics & Jade Dynasty Engine (Day 14)
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
    } catch (error) { 
        res.status(500).json({ error: "Metrics error." }); 
    }
};

// 3. The Dispute Ledger (Day 11)
export const getDisputes = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const orgId = req.user?.organizationId;
        const disputes = await prisma.dispute.findMany({ 
            where: { organizationId: orgId }, 
            include: { payment: true }, 
            orderBy: { createdAt: 'desc' }, 
            take: 50 
        });
        res.json({ disputes });
    } catch (error) { 
        res.status(500).json({ error: "Failed to fetch disputes ledger." }); 
    }
};
CODE

echo "[✅] Controller restored. Re-running the Jade Dynasty Performance Audit..."
npx ts-node src/test_day14.ts
