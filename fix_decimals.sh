#!/bin/bash

echo "[🔧] Engineering correction: Fixing floating point decimals on fee percentages..."

# 1. Update Dashboard Controller to format the percentage cleanly
cat << 'CODE' > src/controllers/dashboardController.ts
import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { encryptStripeKey } from '../utils/encryption';
import { verifyStripeConnection } from '../services/stripeService';
import { getTierConfig } from '../utils/tierLogic';
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
        if (isValid) { res.json({ success: true, message: "[✅] Stripe connection verified. Key Secured." }); } 
        else { res.status(400).json({ error: "Key failed Stripe verification." }); }
    } catch (error) { res.status(500).json({ error: "Failed to secure keys." }); }
};

export const getMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const orgId = req.user?.organizationId;
        const org = await prisma.organization.findUnique({ where: { id: orgId } });
        const totalDisputes = await prisma.dispute.count({ where: { organizationId: orgId } });
        
        const tierConfig = getTierConfig(org!.tier);
        let label = tierConfig.label;
        
        if (org!.tier === 'TRIAL' && org!.accessExpiresAt && org!.accessExpiresAt < new Date()) {
            label = 'Expired';
        }

        // Clean floating point math (e.g., converts 3.50000004 to 3.5)
        const cleanFeePercent = parseFloat((tierConfig.feePercent * 100).toFixed(2));

        res.json({
            metrics: {
                organizationId: org!.id,
                totalDisputes,
                revenueRecoveredFormatted: `$${(org!.revenueRecovered / 100).toFixed(2)}`,
                performanceFeeOwedFormatted: `$${(org!.performanceFeeOwed / 100).toFixed(2)}`,
                pdfsGenerated: org?.pdfsGenerated,
                pdfLimit: tierConfig.pdfLimit,
                currentTierLabel: label,
                currentFeeLabel: `${cleanFeePercent}%`,
                hasStripeKey: !!org!.encryptedStripeKey
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

export const downloadEvidencePdf = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const orgId = req.user?.organizationId;
        const disputeId = req.params.id;
        if (!disputeId || typeof disputeId !== 'string') { res.status(400).json({ error: "Invalid Dispute ID format." }); return; }
        const dispute = await prisma.dispute.findFirst({ where: { id: disputeId, organizationId: orgId } });
        if (!dispute || !dispute.evidencePdfUrl) { res.status(404).json({ error: "Evidence PDF not found." }); return; }
        const filePath = path.resolve(dispute.evidencePdfUrl);
        if (fs.existsSync(filePath)) { res.download(filePath, `Novoriq_Evidence_${dispute.stripeId}.pdf`); } 
        else { res.status(404).json({ error: "File missing from disk." }); }
    } catch (error) { res.status(500).json({ error: "Server error." }); }
};
CODE

# 2. Update Admin Controller to format the percentage cleanly in the resolve message
cat << 'CODE' > src/controllers/adminController.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { getTierConfig } from '../utils/tierLogic';

const prisma = new PrismaClient();

export const getAllOrganizations = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'ADMIN') {
            res.status(403).json({ error: "Access Denied." }); return;
        }
        const orgs = await prisma.organization.findMany({
            include: { _count: { select: { disputes: true, users: true } } }
        });
        res.json({ organizations: orgs });
    } catch (error) { res.status(500).json({ error: "System fault." }); }
};

export const markDisputeWon = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { disputeId } = req.body;
        const dispute = await prisma.dispute.findUnique({
            where: { id: disputeId },
            include: { payment: true, organization: true }
        });

        if (dispute) {
            const tierConfig = getTierConfig(dispute.organization.tier);
            const fee = Math.round(dispute.payment.amount * tierConfig.feePercent);
            
            const cleanFeePercent = parseFloat((tierConfig.feePercent * 100).toFixed(2));

            await prisma.organization.update({
                where: { id: dispute.organizationId },
                data: {
                    revenueRecovered: { increment: dispute.payment.amount },
                    performanceFeeOwed: { increment: fee }
                }
            });
            await prisma.dispute.update({ where: { id: disputeId }, data: { status: 'won' } });
            
            res.json({ 
                success: true, 
                message: `Revenue recovered. Dynamic ${cleanFeePercent}% fee applied.`, 
                feeCalculated: fee 
            });
        } else {
            res.status(404).json({ error: "Dispute not found." });
        }
    } catch (error) { res.status(500).json({ error: "Failed to update recovery state." }); }
};
CODE

echo "[✅] Decimals patched. Restarting backend server..."
pm2 restart all 2>/dev/null || echo "-> Please restart your backend server manually (npm run dev)."
