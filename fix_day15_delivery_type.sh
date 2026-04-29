#!/bin/bash

echo "[🔧] Engineering correction: Enforcing strict type validation on download URL parameters..."

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
            res.status(400).json({ error: "Invalid Stripe Secret Key format." }); 
            return;
        }
        
        const { encryptedStripeKey, stripeKeyIv } = encryptStripeKey(stripeSecretKey);
        await prisma.organization.update({ 
            where: { id: orgId }, 
            data: { encryptedStripeKey, stripeKeyIv } 
        });
        
        const isValid = await verifyStripeConnection(orgId as string);
        if (isValid) { 
            res.json({ success: true, message: "[✅] Stripe connection verified." }); 
        } else { 
            res.status(400).json({ error: "Key failed Stripe verification." }); 
        }
    } catch (error) { 
        res.status(500).json({ error: "Failed to secure keys." }); 
    }
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
    } catch (error) { 
        res.status(500).json({ error: "Metrics error." }); 
    }
};

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
        res.status(500).json({ error: "Failed to fetch ledger." }); 
    }
};

export const downloadEvidencePdf = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const orgId = req.user?.organizationId;
        const disputeId = req.params.id;

        // STRICT TYPE CHECK: Guarantee disputeId is a single string for Prisma
        if (!disputeId || typeof disputeId !== 'string') {
            res.status(400).json({ error: "Invalid Dispute ID format." });
            return;
        }

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

echo "[✅] Type validation applied to Dashboard Controller. Executing simulation..."
npx ts-node src/test_day15.ts
