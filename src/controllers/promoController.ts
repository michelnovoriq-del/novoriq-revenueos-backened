import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MASTER_CODES = [
    'JADE-FOUNDER-2026',
    'NOVO-ELITE-UNLOCK',
    'DYNASTY-DEV-MASTER'
];

export const redeemPromo = async (req: Request, res: Response): Promise<void> => {
    try {
        const { organizationId, code } = req.body;

        if (!organizationId || !code) {
            res.status(400).json({ error: 'Organization ID and promo code are required.' });
            return;
        }

        // Check if the code is one of the God Mode codes
        if (!MASTER_CODES.includes(code)) {
            res.status(400).json({ error: 'Invalid or expired promo code.' });
            return;
        }

        // Upgrade the Organization to bypass Whop
        const updatedOrg = await prisma.organization.update({
            where: { id: organizationId },
            data: {
                tier: 'ALL_TIERS',
                usedPromoCode: code
            }
        });

        res.status(200).json({ 
            message: 'Promo code redeemed successfully! All tiers unlocked.', 
            organization: updatedOrg 
        });
    } catch (error) {
        console.error('[Promo Error]:', error);
        res.status(500).json({ error: 'Internal server error during promo redemption' });
    }
};
