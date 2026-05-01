"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyOrganization = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getMyOrganization = async (req, res) => {
    try {
        // The organizationId is safely injected by our Auth Middleware, NEVER by the user!
        const orgId = req.user?.organizationId;
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            // SECURITY: Never select the encryptedStripeKey here!
            select: { id: true, name: true, tier: true, createdAt: true }
        });
        res.json({ organization: org });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getMyOrganization = getMyOrganization;
