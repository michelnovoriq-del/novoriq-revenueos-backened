import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { getTierConfig } from '../utils/tierLogic';

const prisma = new PrismaClient();

export const getAllOrganizations = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'ADMIN') {
            res.status(403).json({ error: "Access Denied." }); return;
        }
        const orgs = await prisma.organization.findMany({
            include: { _count: { select: { disputes: true, users: true } } }
        });
        res.json({ organizations: orgs });
    } catch (error) { res.status(500).json({ error: "System fault." }); }
};

export const markDisputeWon = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { disputeId } = req.body;
        const dispute = await prisma.dispute.findUnique({
            where: { id: disputeId },
            include: { payment: true, organization: true }
        });

        if (dispute) {
            const tierConfig = getTierConfig(dispute.organization.tier);
            const fee = Math.round(dispute.payment.amount * tierConfig.feePercent);
            
            const cleanFeePercent = parseFloat((tierConfig.feePercent * 100).toFixed(2));

            await prisma.organization.update({
                where: { id: dispute.organizationId },
                data: {
                    revenueRecovered: { increment: dispute.payment.amount },
                    performanceFeeOwed: { increment: fee }
                }
            });
            await prisma.dispute.update({ where: { id: disputeId }, data: { status: 'won' } });
            
            res.json({ 
                success: true, 
                message: `Revenue recovered. Dynamic ${cleanFeePercent}% fee applied.`, 
                feeCalculated: fee 
            });
        } else {
            res.status(404).json({ error: "Dispute not found." });
        }
    } catch (error) { res.status(500).json({ error: "Failed to update recovery state." }); }
};
