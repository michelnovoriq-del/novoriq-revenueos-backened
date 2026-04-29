#!/bin/bash

echo "[🚀] Initiating Day 18: The Whop Matrix & Dynamic Economics..."

mkdir -p src/utils

# 1. Build the Central Tier Logic Engine
cat << 'CODE' > src/utils/tierLogic.ts
export const getTierConfig = (tier: string | null) => {
    switch (tier) {
        case 'TIER_3': 
            return { feePercent: 0.035, pdfLimit: 120, label: 'Tier 3 (Premium)' };
        case 'TIER_2': 
            return { feePercent: 0.05, pdfLimit: 80, label: 'Tier 2 (Pro)' };
        case 'TIER_1': 
            return { feePercent: 0.10, pdfLimit: 50, label: 'Tier 1 (Starter)' };
        case 'TRIAL':  
            // 48-Hour Trial gets Tier 3 features to build maximum curiosity
            return { feePercent: 0.035, pdfLimit: 120, label: '48-Hour Trial Access' }; 
        default:       
            return { feePercent: 0.20, pdfLimit: 0, label: 'Inactive / Locked' };
    }
};
CODE

# 2. Upgrade the Whop Webhook with your exact Plan IDs
cat << 'CODE' > src/webhooks/whopWebhook.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const handleWhopWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
        const payload = req.body;
        
        if (payload.action === 'membership.went_valid') {
            const orgId = payload.data?.metadata?.organizationId;
            const subscriptionId = payload.data?.id;
            
            // Whop passes the plan ID in the webhook payload
            const planId = payload.data?.plan?.id || payload.data?.product?.id; 

            if (orgId) {
                let newTier = 'PRO'; // Fallback
                let expiresAt = null;

                // The Jade Dynasty Mapping
                if (planId === 'plan_g5k8i3tfPkASV') {
                    newTier = 'TRIAL';
                    expiresAt = new Date();
                    expiresAt.setHours(expiresAt.getHours() + 48); // 48 Hour Lock
                } else if (planId === 'plan_pJpWvIqcYCRvV') {
                    newTier = 'TIER_1';
                } else if (planId === 'plan_rE4Rj9g9t8RNH') {
                    newTier = 'TIER_2';
                } else if (planId === 'plan_My5qZYNCRlcgr') {
                    newTier = 'TIER_3';
                }

                await prisma.organization.update({
                    where: { id: orgId },
                    data: { tier: newTier, whopSubscriptionId: subscriptionId, accessExpiresAt: expiresAt }
                });
                console.log(`[💎] Whop Webhook: Organization ${orgId} mapped to ${newTier}.`);
            }
        }

        if (payload.action === 'membership.went_invalid') {
            const orgId = payload.data?.metadata?.organizationId;
            if (orgId) {
                await prisma.organization.update({
                    where: { id: orgId },
                    data: { tier: 'INACTIVE', accessExpiresAt: null }
                });
                console.log(`[⚠️] Whop Webhook: Organization ${orgId} downgraded to INACTIVE.`);
            }
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error("[CRITICAL] Webhook processing failed:", error);
        res.status(400).json({ error: 'Webhook handler failed' });
    }
};
CODE

# 3. Upgrade Admin Controller for Dynamic Fees
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
            // Retrieve dynamic fee percentage based on the user's specific tier
            const tierConfig = getTierConfig(dispute.organization.tier);
            const fee = Math.round(dispute.payment.amount * tierConfig.feePercent);

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
                message: `Revenue recovered. Dynamic ${tierConfig.feePercent * 100}% fee applied.`, 
                feeCalculated: fee 
            });
        } else {
            res.status(404).json({ error: "Dispute not found." });
        }
    } catch (error) { res.status(500).json({ error: "Failed to update recovery state." }); }
};
CODE

# 4. Upgrade Dashboard Controller for Dynamic Limits
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
        if (isValid) { res.json({ success: true, message: "[✅] Stripe connection verified." }); } 
        else { res.status(400).json({ error: "Key failed Stripe verification." }); }
    } catch (error) { res.status(500).json({ error: "Failed to secure keys." }); }
};

export const getMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const orgId = req.user?.organizationId;
        const org = await prisma.organization.findUnique({ where: { id: orgId } });
        const totalDisputes = await prisma.dispute.count({ where: { organizationId: orgId } });
        
        // Fetch dynamic tier configuration
        const tierConfig = getTierConfig(org!.tier);
        
        res.json({
            metrics: {
                totalDisputes,
                revenueRecoveredFormatted: `$${(org!.revenueRecovered / 100).toFixed(2)}`,
                performanceFeeOwedFormatted: `$${(org!.performanceFeeOwed / 100).toFixed(2)}`,
                pdfsGenerated: org?.pdfsGenerated,
                pdfLimit: tierConfig.pdfLimit,
                currentTierLabel: tierConfig.label,
                currentFeeLabel: `${tierConfig.feePercent * 100}%`
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
        if (!dispute || !dispute.evidencePdfUrl) { res.status(404).json({ error: "Evidence PDF not found or still processing." }); return; }
        const filePath = path.resolve(dispute.evidencePdfUrl);
        if (fs.existsSync(filePath)) { res.download(filePath, `Novoriq_Evidence_${dispute.stripeId}.pdf`); } 
        else { res.status(404).json({ error: "File missing from disk." }); }
    } catch (error) { res.status(500).json({ error: "Server error during file transmission." }); }
};
CODE

echo "[✅] Matrix updated. Booting backend engine..."
npm run dev
