import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from './auth';

const prisma = new PrismaClient();

export const requireActiveSubscription = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error verifying subscription status.' });
    }
};
