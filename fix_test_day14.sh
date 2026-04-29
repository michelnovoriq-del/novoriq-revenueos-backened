#!/bin/bash

echo "[🔧] Engineering correction: Seeding test data for Performance Fee Audit..."

cat << 'TEST' > src/test_day14.ts
import { PrismaClient } from '@prisma/client';
import { server } from './index';

const prisma = new PrismaClient();

async function runAudit() {
    console.log("\n[🔒] Running Jade Dynasty Performance Fee Audit...\n");

    try {
        // 1. Authenticate to get JWT
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@novoriq.local', password: 'admin123!' })
        });
        const { token } = await loginRes.json();
        if (!token) throw new Error("Authentication failed.");

        // 2. Fetch Organization
        const org = await prisma.organization.findFirst();
        if (!org) throw new Error("No organization found. Please run database seed.");

        // 3. Ensure a dispute exists. If not, seed one.
        let dispute = await prisma.dispute.findFirst({ where: { organizationId: org.id } });
        
        if (!dispute) {
            console.log("-> 0. Seeding dummy $250.00 dispute for performance fee test...");
            const payment = await prisma.payment.create({
                data: {
                    stripeChargeId: `ch_test_${Date.now()}`,
                    amount: 25000, // $250.00
                    status: 'succeeded',
                    organizationId: org.id
                }
            });
            dispute = await prisma.dispute.create({
                data: {
                    stripeId: `dp_test_${Date.now()}`,
                    reason: 'fraudulent',
                    status: 'needs_response',
                    paymentId: payment.id,
                    organizationId: org.id
                }
            });
        }

        // 4. Mark Dispute as WON via Admin Route
        console.log(`-> 1. Marking Dispute ${dispute.id} as WON...`);
        const resolveRes = await fetch('http://localhost:3000/api/admin/resolve-won', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ disputeId: dispute.id })
        });
        
        const resolveData = await resolveRes.json();
        
        if (!resolveRes.ok) {
            throw new Error(resolveData.error || "Failed to resolve dispute.");
        }

        console.log(`[✅] Action: ${resolveData.message}`);
        console.log(`[💰] System calculated a performance fee of: $${(resolveData.feeCalculated / 100).toFixed(2)} USD`);

        // 5. Verify Organization Metrics updated correctly
        console.log("\n-> 2. Verifying Organization Metrics update...");
        const updatedOrg = await prisma.organization.findUnique({ where: { id: dispute.organizationId } });
        console.log(`[✅] Total Revenue Recovered: $${(updatedOrg!.revenueRecovered / 100).toFixed(2)} USD`);
        console.log(`[✅] Total Performance Fees Owed to you: $${(updatedOrg!.performanceFeeOwed / 100).toFixed(2)} USD`);

    } catch (err) {
        console.error("\n[❌] Audit Failed:", err);
    } finally {
        await prisma.$disconnect();
        server.close();
        process.exit(0);
    }
}

// Give server 1 second to start before running audit
setTimeout(runAudit, 1000);
TEST

echo "[✅] Test script rebuilt. Executing simulation..."
npx ts-node src/test_day14.ts
