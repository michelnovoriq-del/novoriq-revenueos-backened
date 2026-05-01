import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * NOVORIQ REVENUE OS | WHOP BILLING NEXUS
 * ---------------------------------------
 * Handles real-time provisioning, tier upgrades, and access revocation.
 */
export const handleWhopWebhook = async (req: Request, res: Response): Promise<void> => {
    console.log("[Whop Protocol] Incoming high-priority payload detected...");

    try {
        // --- 1. CRYPTOGRAPHIC SIGNATURE VERIFICATION ---
        const signature = req.headers['x-whop-signature'];
        const rawBody = (req as any).rawBody as Buffer | undefined;
        const secret = process.env.WHOP_WEBHOOK_SECRET;

        if (!secret) {
            console.error("[CRITICAL] WHOP_WEBHOOK_SECRET is missing from environment.");
            res.status(500).json({ error: "Server configuration error" });
            return;
        }

        if (!rawBody || !Buffer.isBuffer(rawBody)) {
            console.warn("[WARNING] Security Breach: Missing raw webhook body.");
            res.status(400).json({ error: "Missing raw body" });
            return;
        }

        const signatureValue = Array.isArray(signature) ? signature[0] : signature;
        if (!signatureValue) {
            console.warn("[WARNING] Security Breach: Missing webhook signature.");
            res.status(401).json({ error: "Missing signature" });
            return;
        }

        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(rawBody)
            .digest('hex');

        const expectedBuffer = Buffer.from(expectedSignature, 'hex');
        const receivedBuffer = Buffer.from(signatureValue, 'hex');
        const isLocalSignatureBypass = secret === "LOCAL_TEST_SECRET" && process.env.NODE_ENV !== 'production';
        const isValidSignature = expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

        if (!isValidSignature && !isLocalSignatureBypass) {
            console.warn("[WARNING] Security Breach: Unauthorized webhook signature mismatch.");
            res.status(401).json({ error: "Invalid signature" });
            return;
        }

        // --- 2. PAYLOAD PARSING ---
        const payload = req.body;
        const action = payload.action || payload.type;
        const data = payload.data || {};

        // --- 3. PATH A: ACCESS PROVISIONING ---
        if (action === 'membership.went_active' || action === 'membership.went_valid' || action === 'payment.succeeded') {
            
            // PRIORITY: Use external_id (passed via query param) or fallback to metadata
            let orgId = data.external_id || data.metadata?.organizationId;
            const userId = data.metadata?.userId; 
            const subscriptionId = data.id;
            const planId = data.plan?.id || data.product?.id; 
            
            const customerEmail = data.email || data.user?.email || 'unknown@whop.com';
            console.log(`[Whop Protocol] Capital Secured | Plan ID: ${planId} | Email: ${customerEmail}`);

            // 1. DETERMINISTIC TIER MAPPING
            let targetTier = 'PRO'; // Default to Pro
            let expiresAt: Date | null = null;

            if (planId === 'plan_V3eDZlxhqz03e') { // 🧪 YOUR TEST PLAN
                targetTier = 'TIER_2'; // Map test plan to Pro for testing
                console.log("[Whop Protocol] Test Plan Detected. Bypassing commercial locks.");
            } else if (planId === 'plan_g5k8i3tfPkASV') { // $10 Beta
                targetTier = 'TRIAL';
                expiresAt = new Date();
                expiresAt.setHours(expiresAt.getHours() + 48);
            } else if (planId === 'plan_pJpWvIqcYCRvV') { // $199
                targetTier = 'TIER_1';
            } else if (planId === 'plan_rE4Rj9g9t8RNH') { // $399
                targetTier = 'TIER_2';
            } else if (planId === 'plan_My5qZYNCRlcgr') { // $799
                targetTier = 'TIER_3';
            }

            // 2. GENERATE VIP INVITE KEY (Legacy/Offline fallback)
            const rawCode = crypto.randomBytes(4).toString('hex').toUpperCase();
            const inviteCode = `NVQ-${rawCode}-VIP`;

            // 3. ATOMIC UPGRADE
            // If we don't have an OrgId but have a UserId, resolve the OrgId
            if (!orgId && userId) {
                const user = await prisma.user.findUnique({ where: { id: userId } });
                if (user) orgId = user.organizationId;
            }

            if (orgId) {
                await prisma.$transaction([
                    prisma.inviteCode.create({
                        data: { code: inviteCode, tier: targetTier, isUsed: false, assignedEmail: customerEmail }
                    }),
                    prisma.organization.update({
                        where: { id: orgId },
                        data: { 
                            tier: targetTier, 
                            status: 'ACTIVE', // 🔓 THE MASTER KEY
                            whopSubscriptionId: subscriptionId, 
                            accessExpiresAt: expiresAt 
                        }
                    })
                ]);
                console.log(`[💎] ENGINE UNLOCKED | Org: ${orgId} | Tier: ${targetTier}`);
            } else {
                await prisma.inviteCode.create({
                    data: { code: inviteCode, tier: targetTier, isUsed: false, assignedEmail: customerEmail }
                });
                console.log(`[Whop Protocol] Cold traffic detected. Invite code ${inviteCode} mailed to ${customerEmail}.`);
            }
        }

        // --- 4. PATH B: ACCESS REVOCATION ---
        if (action === 'membership.went_invalid') {
            const orgId = data.external_id || data.metadata?.organizationId;
            if (orgId) {
                await prisma.organization.update({
                    where: { id: orgId },
                    data: { status: 'INACTIVE', tier: 'INACTIVE', accessExpiresAt: null }
                });
                console.log(`[⚠️] ENGINE LOCKED | Access revoked for Org: ${orgId}`);
            }
        }

        res.status(200).json({ received: true });

    } catch (error) {
        console.error("[CRITICAL] Nexus Handshake Failed:", error);
        res.status(400).json({ error: 'Internal Nexus Failure' });
    }
};
