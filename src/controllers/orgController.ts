import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const getMyOrganization = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        // The organizationId is safely injected by our Auth Middleware, NEVER by the user!
        const orgId = req.user?.organizationId;
        
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            // SECURITY: Never select the encryptedStripeKey here!
            select: { id: true, name: true, tier: true, createdAt: true } 
        });
        
        res.json({ organization: org });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
