import { PrismaClient } from '@prisma/client';
import { generateCompellingEvidence } from './pdfService'; // Note: Ensure this path matches your setup

const prisma = new PrismaClient();

export const processQueue = async () => {
    // Find the oldest pending dispute
    const dispute = await prisma.dispute.findFirst({
        where: { processingStatus: 'PENDING' },
        include: { payment: true, organization: true },
        orderBy: { createdAt: 'asc' }
    });

    if (!dispute) return;

    console.log(`[⚙️] Worker: Processing Dispute ${dispute.stripeId}...`);

    try {
        // Mark as processing to prevent other workers from grabbing it
        await prisma.dispute.update({
            where: { id: dispute.id },
            data: { processingStatus: 'PROCESSING' }
        });

        const pdfPath = await generateCompellingEvidence({
            disputeId: dispute.stripeId,
            chargeId: dispute.payment.stripeChargeId,
            amount: dispute.payment.amount,
            reason: dispute.reason,
            date: dispute.payment.createdAt.toISOString().split('T')[0],
            organizationName: dispute.organization.name,
            
            // 🚨 ADDED TO FIX THE TS ERROR:
            customerName: 'Historical Record',
            customerEmail: 'Historical Record'
        });

        await prisma.dispute.update({
            where: { id: dispute.id },
            data: { 
                evidencePdfUrl: pdfPath,
                processingStatus: 'COMPLETED'
            }
        });

        console.log(`[✅] Worker: Successfully generated PDF for ${dispute.stripeId}`);
    } catch (error) {
        console.error(`[❌] Worker: Failed ${dispute.stripeId}`, error);
        await prisma.dispute.update({
            where: { id: dispute.id },
            data: { processingStatus: 'FAILED' }
        });
    }
};

// Polling interval: Check every 5 seconds
setInterval(processQueue, 5000);
console.log("[🚀] Novoriq Worker initialized and polling for tasks...");