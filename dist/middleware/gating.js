"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireActiveSubscription = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const requireActiveSubscription = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ error: "Unauthorized: Missing identity context." });
            return;
        }
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { tier: true, status: true, accessExpiresAt: true }
        });
        if (!org || org.status !== 'ACTIVE') {
            res.status(403).json({ error: 'PAYWALL: Active subscription or valid trial required to perform this action.' });
            return;
        }
        // 1. Paid Users bypass all time checks
        if (['PRO', 'TIER_1', 'TIER_2', 'TIER_3', 'ALL_TIERS'].includes(org.tier)) {
            next();
            return;
        }
        // 2. Trial Users are checked against the exact current time
        if (org.tier === 'TRIAL' && org.accessExpiresAt && org.accessExpiresAt > new Date()) {
            next();
            return;
        }
        // 3. Everyone else hits the paywall
        res.status(403).json({ error: 'PAYWALL: Active subscription or valid trial required to perform this action.' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error verifying subscription status.' });
    }
};
exports.requireActiveSubscription = requireActiveSubscription;
