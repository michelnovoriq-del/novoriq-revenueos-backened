import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const getHeaderValue = (header: string | string[] | undefined): string | undefined => {
    return Array.isArray(header) ? header[0] : header;
};

const timingSafeStringEqual = (left: string, right: string): boolean => {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const getStandardWebhookSecret = (secret: string): Buffer => {
    if (secret.startsWith('whsec_')) {
        return Buffer.from(secret.slice('whsec_'.length), 'base64');
    }

    return Buffer.from(secret, 'utf8');
};

const parseStandardWebhookSignatures = (signatureHeader: string): string[] => {
    return signatureHeader
        .split(/\s+/)
        .flatMap((part) => part.split(','))
        .map((part) => part.trim())
        .filter((part) => part && part !== 'v1');
};

const verifyStandardWebhookSignature = (
    rawBody: Buffer,
    webhookId: string,
    timestamp: string,
    signatureHeader: string,
    secret: string
): boolean => {
    const signedContent = `${webhookId}.${timestamp}.${rawBody.toString('utf8')}`;
    const expectedSignature = crypto
        .createHmac('sha256', getStandardWebhookSecret(secret))
        .update(signedContent)
        .digest('base64');

    return parseStandardWebhookSignatures(signatureHeader).some((signature) => {
        return timingSafeStringEqual(signature, expectedSignature);
    });
};

const verifyLegacyWebhookSignature = (rawBody: Buffer, signature: string, secret: string): boolean => {
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

    return timingSafeStringEqual(signature, expectedSignature);
};

/**
 * NOVORIQ REVENUE OS | WHOP BILLING NEXUS
 * ---------------------------------------
 * Handles real-time provisioning, tier upgrades, and access revocation.
 */
export const handleWhopWebhook = async (req: Request, res: Response): Promise<void> => {
    console.log("[Whop Protocol] Incoming high-priority payload detected...");

    try {
        // --- 1. CRYPTOGRAPHIC SIGNATURE VERIFICATION ---
        const legacySignature = getHeaderValue(req.headers['x-whop-signature']);
        const standardSignature = getHeaderValue(req.headers['webhook-signature']);
        const webhookId = getHeaderValue(req.headers['webhook-id']);
        const webhookTimestamp = getHeaderValue(req.headers['webhook-timestamp']);
        const rawBody = (req as any).rawBody as Buffer | undefined;
        const secret = process.env.WHOP_WEBHOOK_KEY || process.env.WHOP_WEBHOOK_SECRET;

        if (!secret) {
            console.error("[CRITICAL] WHOP_WEBHOOK_KEY or WHOP_WEBHOOK_SECRET is missing from environment.");
            res.status(500).json({ error: "Server configuration error" });
            return;
        }

        if (!rawBody || !Buffer.isBuffer(rawBody)) {
            console.warn("[WARNING] Security Breach: Missing raw webhook body.");
            res.status(400).json({ error: "Missing raw body" });
            return;
        }

        if (!standardSignature && !legacySignature) {
            console.warn("[WARNING] Security Breach: Missing webhook signature.");
            res.status(401).json({ error: "Missing signature" });
            return;
        }

        const isLocalSignatureBypass = secret === "LOCAL_TEST_SECRET" && process.env.NODE_ENV !== 'production';
        const isValidStandardSignature = !!(standardSignature && webhookId && webhookTimestamp)
            && verifyStandardWebhookSignature(rawBody, webhookId, webhookTimestamp, standardSignature, secret);
        const isValidLegacySignature = !!legacySignature && verifyLegacyWebhookSignature(rawBody, legacySignature, secret);
        const isValidSignature = isValidStandardSignature || isValidLegacySignature;

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

            // [UPDATED] Injecting the new E2E test plan (plan_rUbJAjG7Mt0mv) alongside existing legacy test IDs
            if (planId === 'plan_rUbJAjG7Mt0mv' || planId === 'plan_12uLHFgtctUFl' || planId === 'plan_V3eDZlxhqz03e') { 
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