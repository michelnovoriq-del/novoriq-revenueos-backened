"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateTrial = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const activateTrial = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const org = await prisma.organization.findUnique({ where: { id: orgId } });
        if (org?.tier === 'PRO') {
            res.status(400).json({ error: "Organization is already on a paid PRO tier." });
            return;
        }
        if (org?.tier === 'TRIAL') {
            res.status(400).json({ error: "Trial has already been activated." });
            return;
        }
        // Calculate exact expiration time (48 hours from right now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 48);
        await prisma.organization.update({
            where: { id: orgId },
            data: {
                tier: 'TRIAL',
                accessExpiresAt: expiresAt
            }
        });
        res.json({ success: true, tier: 'TRIAL', expiresAt });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error during trial activation.' });
    }
};
exports.activateTrial = activateTrial;
