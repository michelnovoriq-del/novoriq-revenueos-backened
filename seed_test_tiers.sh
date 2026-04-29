#!/bin/bash

echo "[🚀] Initiating Database Seeding: Generating Test Accounts..."

cat << 'CODE' > src/seed_tiers.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seed() {
    console.log("[🌱] Seeding Jade Dynasty Test Accounts...");

    // We will use a standard password for all test accounts
    const plainPassword = 'password123!';
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const testTiers = [
        { email: 'trial@novoriq.local', tier: 'TRIAL', name: 'Trial Corp (48H)' },
        { email: 'tier1@novoriq.local', tier: 'TIER_1', name: 'Starter LLC' },
        { email: 'tier2@novoriq.local', tier: 'TIER_2', name: 'Pro Enterprises' },
        { email: 'tier3@novoriq.local', tier: 'TIER_3', name: 'Premium Empire' }
    ];

    for (const config of testTiers) {
        // 1. Clean up old test data if it exists to avoid unique constraint crashes
        await prisma.user.deleteMany({ where: { email: config.email } });

        // Set expiration only for the Trial account (expires in 48 hours)
        let expiresAt = null;
        if (config.tier === 'TRIAL') {
            expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 48);
        }

        // 2. Create the Organization
        const org = await prisma.organization.create({
            data: {
                name: config.name,
                tier: config.tier,
                accessExpiresAt: expiresAt,
                revenueRecovered: 0,
                performanceFeeOwed: 0,
                pdfsGenerated: 0
            }
        });

        // 3. Create the User
        await prisma.user.create({
            data: {
                email: config.email,
                passwordHash: passwordHash,
                role: 'USER',
                organizationId: org.id
            }
        });

        // 4. Seed a dummy dispute so the dashboard isn't completely empty
        const payment = await prisma.payment.create({
            data: {
                stripeChargeId: `ch_test_${config.tier}_${Date.now()}`,
                amount: Math.floor(Math.random() * 50000) + 10000, // Random amount between $100 and $600
                status: 'succeeded',
                organizationId: org.id
            }
        });

        await prisma.dispute.create({
            data: {
                stripeId: `dp_test_${config.tier}_${Date.now()}`,
                reason: 'fraudulent',
                status: 'needs_response',
                paymentId: payment.id,
                organizationId: org.id
            }
        });

        console.log(`[✅] Created ${config.tier} Account -> ${config.email}`);
    }

    console.log("\n[🎉] Seeding Complete! Database is locked and loaded for deployment.");
}

seed()
    .catch(e => {
        console.error("Seeding failed. If bcrypt is missing, installing it now...", e);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
CODE

# Ensure bcrypt and its types are installed just in case
npm install bcrypt
npm install --save-dev @types/bcrypt

echo "[⚡] Running the Seed Script..."
npx ts-node src/seed_tiers.ts
