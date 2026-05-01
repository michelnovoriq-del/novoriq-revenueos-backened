"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWhopWebhook = void 0;
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const prisma = new client_1.PrismaClient();
const handleWhopWebhook = async (req, res) => {
    try {
        // --- 1. CRYPTOGRAPHIC SIGNATURE VERIFICATION ---
        const signature = req.headers['x-whop-signature'];
        // FIXED: Pull the exact raw byte string from our new buffer middleware
        const payloadString = req.rawBody.toString();
        const secret = process.env.WHOP_WEBHOOK_SECRET;
        if (!secret) {
            console.error("[CRITICAL] WHOP_WEBHOOK_SECRET is missing.");
            res.status(500).json({ error: "Server configuration error" });
            return;
        }
        const expectedSignature = crypto_1.default
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
        if (payload.action === 'membership.went_valid') {
            let orgId = payload.data?.metadata?.organizationId;
            const userId = payload.data?.metadata?.userId; // The Master Key
            const subscriptionId = payload.data?.id;
            const planId = payload.data?.plan?.id || payload.data?.product?.id;
            // BULLETPROOFING: If Whop missed the orgId but caught the userId, find it ourselves.
            if (!orgId && userId) {
                const user = await prisma.user.findUnique({ where: { id: userId } });
                if (user)
                    orgId = user.organizationId;
            }
            if (orgId) {
                let newTier = 'PRO';
                let expiresAt = null;
                if (planId === 'plan_g5k8i3tfPkASV') {
                    newTier = 'TRIAL';
                    expiresAt = new Date();
                    expiresAt.setHours(expiresAt.getHours() + 48);
                }
                else if (planId === 'plan_pJpWvIqcYCRvV') {
                    newTier = 'TIER_1';
                }
                else if (planId === 'plan_rE4Rj9g9t8RNH') {
                    newTier = 'TIER_2';
                }
                else if (planId === 'plan_My5qZYNCRlcgr') {
                    newTier = 'TIER_3';
                }
                await prisma.organization.update({
                    where: { id: orgId },
                    data: { tier: newTier, whopSubscriptionId: subscriptionId, accessExpiresAt: expiresAt }
                });
                // Complete Audit Log
                console.log(`[💎] Whop Receipt Validated | User: ${userId || 'SYSTEM'} | Org: ${orgId} | Upgraded to: ${newTier}`);
            }
        }
        if (payload.action === 'membership.went_invalid') {
            let orgId = payload.data?.metadata?.organizationId;
            const userId = payload.data?.metadata?.userId;
            if (!orgId && userId) {
                const user = await prisma.user.findUnique({ where: { id: userId } });
                if (user)
                    orgId = user.organizationId;
            }
            if (orgId) {
                await prisma.organization.update({
                    where: { id: orgId },
                    data: { tier: 'INACTIVE', accessExpiresAt: null }
                });
                console.log(`[⚠️] Whop Downgrade | User: ${userId || 'SYSTEM'} | Org: ${orgId} | Locked.`);
            }
        }
        res.status(200).json({ received: true });
    }
    catch (error) {
        console.error("[CRITICAL] Webhook processing failed:", error);
        res.status(400).json({ error: 'Webhook handler failed' });
    }
};
exports.handleWhopWebhook = handleWhopWebhook;
