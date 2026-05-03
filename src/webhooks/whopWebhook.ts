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

// --- 📣 NEW: ESCALATION MATRIX BROADCASTER ---
const sendCriticalFraudAlert = async (
    clientWebhookUrl: string, 
    customerEmail: string, 
    trustScore: number, 
    recommendation: string
): Promise<void> => {
    if (!clientWebhookUrl) return;

    const payload = {
        content: `🚨 **CRITICAL FRAUD WARNING: Novoriq Intelligence Node** 🚨\n\n**Target Account:** \`${customerEmail}\`\n**Trust Score:** \`${trustScore}/100\`\n\n**AI Recommendation:**\n> ${recommendation}\n\n*Please review this transaction immediately in your Novoriq Dashboard.*`
    };

    try {
        await fetch(clientWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log(`[📣] Critical alert broadcasted successfully for ${customerEmail}`);
    } catch (error) {
        console.error(`[❌] Failed to broadcast alert:`, error);
    }
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
        
        // --- 🛡️ 3. THE DOUBLE-BILLING GUARD ---
        const eventId = data.id || webhookId; 
        
        if (eventId) {
            try {
                await prisma.processedWebhook.create({
                    data: { eventId: eventId },
                });
            } catch (error: any) {
                if (error.code === 'P2002') {
                    console.log(`[⚠️] Double-Billing Guard Activated. Ignored duplicate Whop event: ${eventId}`);
                    res.status(200).json({ status: "skipped", reason: "duplicate_event" });
                    return; 
                }
                throw error; 
            }
        }

        console.log("[DEBUG PAYLOAD] Whop Data:", JSON.stringify(data, null, 2));
        console.log(`[DEBUG ACTION] Whop fired action: ${action}`);

        // --- 4. PATH A: ACCESS PROVISIONING ---
        if (action === 'membership.went_active' || action === 'membership.went_valid' || action === 'payment.succeeded' || action === 'membership.activated') {
            
            let orgId = data.external_id || data.metadata?.organizationId;
            const userId = data.metadata?.userId; 
            const subscriptionId = data.id;
            const planId = data.plan?.id || data.product?.id; 
            
            const customerEmail = data.email || data.user?.email || 'unknown@whop.com';
            console.log(`[Whop Protocol] Capital Secured | Plan ID: ${planId} | Email: ${customerEmail}`);

            // 1. DETERMINISTIC TIER MAPPING
            let targetTier = 'PRO'; 
            let expiresAt: Date | null = null;

            if (planId === 'plan_rUbJAjG7Mt0mv' || planId === 'plan_12uLHFgtctUFl' || planId === 'plan_V3eDZlxhqz03e') { 
                targetTier = 'TIER_2'; 
                console.log("[Whop Protocol] Test Plan Detected. Bypassing commercial locks.");
            } else if (planId === 'plan_g5k8i3tfPkASV') { 
                targetTier = 'TRIAL';
                expiresAt = new Date();
                expiresAt.setHours(expiresAt.getHours() + 48);
            } else if (planId === 'plan_pJpWvIqcYCRvV') { 
                targetTier = 'TIER_1';
            } else if (planId === 'plan_rE4Rj9g9t8RNH') { 
                targetTier = 'TIER_2';
            } else if (planId === 'plan_My5qZYNCRlcgr') { 
                targetTier = 'TIER_3';
            }

            // 2. GENERATE VIP INVITE KEY
            const rawCode = crypto.randomBytes(4).toString('hex').toUpperCase();
            const inviteCode = `NVQ-${rawCode}-VIP`;

            // --- 🚨 THE EMAIL BRIDGE (NEW FALLBACK) ---
            if (!orgId && customerEmail && customerEmail !== 'unknown@whop.com') {
                const existingUser = await prisma.user.findUnique({ 
                    where: { email: customerEmail } 
                });
                if (existingUser && existingUser.organizationId) {
                    orgId = existingUser.organizationId;
                    console.log(`[Whop Protocol] Identity Bridged! Matched ${customerEmail} to Org: ${orgId}`);
                }
            }

            // 3. ATOMIC UPGRADE
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
                            status: 'ACTIVE', 
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

            // --- 🧠 4.5 SILENT COPILOT RISK ASSESSMENT & MEMORY LOGGING ---
            try {
                const pythonServerUrl = process.env.PYTHON_NODE_URL || 'http://127.0.0.1:8000';
                const paymentAmount = data.price || data.plan?.price || 1000; 

                const riskResponse = await fetch(`${pythonServerUrl}/api/v1/analyze-risk`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-internal-key': process.env.INTERNAL_API_KEY || 'nvq_internal_super_secret_key_123',
                    },
                    body: JSON.stringify({
                        transaction_id: eventId,
                        amount: paymentAmount,
                        customer_history_count: 0 
                    })
                });

                if (riskResponse.ok) {
                    const riskData = await riskResponse.json();
                    
                    if (riskData.status !== "skipped" && riskData.evaluation) {
                        const evaluation = riskData.evaluation;
                        console.log(`[🧠] AI Risk Assessment: ${evaluation.alert_level} (${evaluation.trust_score}/100)`);

                        if (evaluation.alert_level === 'CRITICAL_WARNING') {
                            const clientWebhookUrl = process.env.TEST_DISCORD_WEBHOOK_URL; 
                            if (clientWebhookUrl) {
                                await sendCriticalFraudAlert(clientWebhookUrl, customerEmail, evaluation.trust_score, evaluation.recommendation);
                            } else {
                                console.log(`[⚠️] Alert suppressed: TEST_DISCORD_WEBHOOK_URL not configured in .env`);
                            }
                        }

                        // 🗄️ THE DASHBOARD MEMORY: Log the payment AND the AI's intelligence
                        if (orgId) {
                            await prisma.payment.create({
                                data: {
                                    stripeChargeId: eventId,
                                    amount: paymentAmount,
                                    status: 'succeeded',
                                    organizationId: orgId,
                                    trustScore: evaluation.trust_score,
                                    alertLevel: evaluation.alert_level,
                                    aiRecommendation: evaluation.recommendation
                                }
                            });
                            console.log(`[🗄️] Payment and AI Risk Intelligence committed to database for Org: ${orgId}`);
                        }
                    }
                }
            } catch (error) {
                console.log(`[⚠️] AI Risk Engine unreachable. Transaction processed normally.`);
                // Fallback: If Python is down, still log the successful payment (without AI data)
                if (orgId) {
                    const paymentAmount = data.price || data.plan?.price || 1000; 
                    await prisma.payment.create({
                        data: {
                            stripeChargeId: eventId,
                            amount: paymentAmount,
                            status: 'succeeded',
                            organizationId: orgId,
                        }
                    });
                    console.log(`[🗄️] Standard Payment committed to database for Org: ${orgId} (Without AI Intelligence)`);
                }
            }
        }

        // --- 5. PATH B: ACCESS REVOCATION ---
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
        
        // --- 🧠 6. PATH C: THE PYTHON AI CHURN GUARD ---
        if (action === 'payment.failed') {
            const orgId = data.external_id || data.metadata?.organizationId || 'org_unknown';
            const customerEmail = data.email || data.user?.email || 'unknown@whop.com';
            
            console.log(`[🧠] Payment Failed for ${customerEmail}. Bridging to Python Intelligence Node...`);
            
            try {
                const pythonServerUrl = process.env.PYTHON_NODE_URL || 'http://127.0.0.1:8000';
                
                await fetch(`${pythonServerUrl}/api/v1/trigger-churn-guard`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-internal-key': process.env.INTERNAL_API_KEY || 'nvq_internal_super_secret_key_123',
                    },
                    body: JSON.stringify({
                        organization_id: orgId,
                        customer_email: customerEmail,
                        decline_code: data.decline_code || "insufficient_funds", 
                        days_until_expiration: 0
                    })
                });
                console.log(`[✅] Payload successfully forwarded to Python Node.`);
            } catch (bridgeError) {
                console.error(`[❌] Failed to contact Python Intelligence Node:`, bridgeError);
            }
        }

        res.status(200).json({ received: true });

    } catch (error) {
        console.error("[CRITICAL] Nexus Handshake Failed:", error);
        res.status(400).json({ error: 'Internal Nexus Failure' });
    }
};