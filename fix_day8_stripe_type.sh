#!/bin/bash

echo "[🔧] Engineering correction: Enforcing strict type validation on webhook URL parameters..."

# 1. Rewrite the full Stripe Webhook Controller with explicit type checking
cat << 'CODE' > src/webhooks/stripeWebhook.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
    const orgId = req.params.organizationId;
    
    // STRICT TYPE CHECK: Guarantee orgId is a single string for Prisma
    if (!orgId || typeof orgId !== 'string') {
        res.status(400).json({ error: 'Invalid or missing Organization ID in URL parameters.' });
        return;
    }
    
    try {
        // req.body is a Buffer here because of our strict routing rules in index.ts.
        const payloadString = req.body.toString('utf8');
        const event = JSON.parse(payloadString);

        if (event.type === 'charge.dispute.created') {
            const dispute = event.data.object;
            const chargeId = dispute.charge;
            const reason = dispute.reason;

            console.log(`\n[⚡] STRIPE EVENT INGESTED: Dispute created for charge ${chargeId}`);
            console.log(`     Reason: ${reason}`);

            // Ensure the payment exists in our database before mapping the dispute
            const payment = await prisma.payment.findUnique({ where: { stripeChargeId: chargeId } });
            
            if (payment) {
                // Log the dispute securely mapped to the correct tenant
                await prisma.dispute.create({
                    data: {
                        stripeId: dispute.id,
                        reason: reason,
                        status: 'needs_response',
                        paymentId: payment.id,
                        organizationId: orgId
                    }
                });
                console.log(`[✅] Dispute ${dispute.id} securely locked into tenant vault.`);
            } else {
                console.log(`[⚠️] Security Warning: Charge ${chargeId} not found in database.`);
            }
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error("[CRITICAL] Stripe Webhook parsing failed:", error);
        res.status(400).send(`Webhook Error: ${(error as Error).message}`);
    }
};
CODE

echo "[✅] Type validation applied. Executing simulation..."
npx ts-node src/test_day8.ts
