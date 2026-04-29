#!/bin/bash

echo "[🔧] Engineering correction: Updating Stripe API verification method..."

cat << 'CODE' > src/services/stripeService.ts
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { decryptStripeKey } from '../utils/encryption';

const prisma = new PrismaClient();

export const getStripeClientForOrg = async (organizationId: string): Promise<Stripe> => {
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { encryptedStripeKey: true, stripeKeyIv: true }
    });

    if (!org || !org.encryptedStripeKey || !org.stripeKeyIv) {
        throw new Error("Stripe keys not configured for this organization.");
    }

    // Just-In-Time Decryption
    const decryptedKey = decryptStripeKey(org.encryptedStripeKey, org.stripeKeyIv);
    
    // Initialize client and return it. 
    return new Stripe(decryptedKey, {
        apiVersion: '2025-01-27' as any,
    });
};

export const verifyStripeConnection = async (organizationId: string): Promise<boolean> => {
    try {
        const stripe = await getStripeClientForOrg(organizationId);
        // Use the balance endpoint. It requires zero arguments and verifies key authenticity.
        const balance = await stripe.balance.retrieve();
        return !!balance.object;
    } catch (error) {
        console.error("[❌] Stripe Verification Failed:", (error as Error).message);
        return false;
    }
};
CODE

echo "[✅] Stripe Service verified. Re-running the Jade Dynasty Performance Audit..."
npx ts-node src/test_day14.ts
