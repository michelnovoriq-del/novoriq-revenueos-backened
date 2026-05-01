import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export const handleWhopWebhook = async (req: Request, res: Response): Promise<void> => {
    console.log("[Whop Protocol] Incoming payload detected...");

    try {
        // --- 1. CRYPTOGRAPHIC SIGNATURE VERIFICATION ---
        const signature = req.headers['x-whop-signature'] as string;
        
        // Using the exact raw byte string from our buffer middleware
        const payloadString = (req as any).rawBody.toString(); 
        const secret = process.env.WHOP_WEBHOOK_SECRET;

        if (!secret) {
            console.error("[CRITICAL] WHOP_WEBHOOK_SECRET is missing.");
            res.status(500).json({ error: "Server configuration error" });
            return;
        }

        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(payloadString)
            .digest('hex');

        // Allow bypassing signature ONLY if testing locally
        if (signature !== expectedSignature && secret !== "LOCAL_TEST_SECRET") {
            console.warn("[WARNING] Unauthorized webhook attempt: Signature mismatch");
            res.status(401).json({ error: "Invalid signature" });
            return;
        }

        // --- 2. BUSINESS LOGIC ---
        const payload = req.body;
        const action = payload.action || payload.type;
        
        // PATH A: PAYMENT SECURED & ACCOUNT PROVISIONING
        if (action === 'membership.went_valid' || action === 'payment.succeeded') {
            
            // Extract core data
            let orgId = payload.data?.metadata?.organizationId;
            const userId = payload.data?.metadata?.userId; 
            const subscriptionId = payload.data?.id;
            const planId = payload.data?.plan?.id || payload.data?.product?.id; 
            
            const customerEmail = payload.data?.email || payload.data?.user?.email || 'unknown@whop.com';
            const planPurchased = payload.data?.plan?.name || payload.data?.product?.name || 'Enterprise Tier';

            console.log(`[Whop Protocol] Payment secured from: ${customerEmail}. Plan: ${planPurchased}`);

            // 1. Determine the exact internal Tier
            let newTier = 'PRO'; 
            let expiresAt = null;

            if (planId === 'plan_g5k8i3tfPkASV') {
                newTier = 'TRIAL';
                expiresAt = new Date();
                expiresAt.setHours(expiresAt.getHours() + 48);
            } else if (planId === 'plan_pJpWvIqcYCRvV') {
                newTier = 'TIER_1';
            } else if (planId === 'plan_rE4Rj9g9t8RNH') {
                newTier = 'TIER_2';
            } else if (planId === 'plan_My5qZYNCRlcgr') {
                newTier = 'TIER_3'; // God Mode
            }

            // 2. Generate the VIP Invite Code (Cold Traffic / Backup Key)
            const rawCode = crypto.randomBytes(4).toString('hex').toUpperCase();
            const inviteCode = `NVQ-${rawCode}-VIP`;

            await prisma.inviteCode.create({
                data: {
                    code: inviteCode,
                    tier: newTier, 
                    isUsed: false,
                    assignedEmail: customerEmail
                }
            });
            console.log(`[Whop Protocol] SUCCESS: VIP Key Generated -> ${inviteCode}`);

            // 3. Direct Engine Upgrade (If they checked out from inside the app)
            if (!orgId && userId) {
                const user = await prisma.user.findUnique({ where: { id: userId } });
                if (user) orgId = user.organizationId;
            }

            if (orgId) {
                await prisma.organization.update({
                    where: { id: orgId },
                    data: { tier: newTier, whopSubscriptionId: subscriptionId, accessExpiresAt: expiresAt }
                });
                console.log(`[💎] Whop Receipt Validated | User: ${userId || 'SYSTEM'} | Org: ${orgId} | Upgraded to: ${newTier}`);
            } else {
                console.log(`[Whop Protocol] Cold traffic purchase. User must apply Invite Code on registration to unlock OS.`);
            }
        }

        // PATH B: CANCELLATIONS & DOWNGRADES
        if (action === 'membership.went_invalid') {
            let orgId = payload.data?.metadata?.organizationId;
            const userId = payload.data?.metadata?.userId;
            
            if (!orgId && userId) {
                const user = await prisma.user.findUnique({ where: { id: userId } });
                if (user) orgId = user.organizationId;
            }

            if (orgId) {
                await prisma.organization.update({
                    where: { id: orgId },
                    data: { tier: 'INACTIVE', accessExpiresAt: null }
                });
                console.log(`[⚠️] Whop Downgrade | User: ${userId || 'SYSTEM'} | Org: ${orgId} | Locked.`);
            }
        }

        // Always return 200 OK immediately so Whop doesn't retry the webhook
        res.status(200).json({ received: true });

    } catch (error) {
        console.error("[CRITICAL] Webhook processing failed:", error);
        res.status(400).json({ error: 'Webhook handler failed' });
    }
};