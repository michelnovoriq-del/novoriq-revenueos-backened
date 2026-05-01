"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const index_1 = require("./index");
const prisma = new client_1.PrismaClient();
async function runAudit() {
    console.log("\n[🔒] Running Client Dashboard API Audit...\n");
    try {
        // 1. Authenticate to get JWT
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@novoriq.local', password: 'admin123!' })
        });
        const { token } = await loginRes.json();
        if (!token)
            throw new Error("Failed to authenticate.");
        // 2. Submit Stripe Key to the Vault
        console.log("-> 1. Submitting Stripe API Key from Frontend UI...");
        const keyRes = await fetch('http://localhost:3000/api/dashboard/keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ stripeSecretKey: 'sk_live_jade_dynasty_999888777' })
        });
        const keyData = await keyRes.json();
        console.log(keyData.message);
        // 3. Fetch Dashboard Metrics
        console.log("\n-> 2. Fetching Overview Metrics for UI...");
        const metricsRes = await fetch('http://localhost:3000/api/dashboard/metrics', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const { metrics } = await metricsRes.json();
        console.log(`[✅] Metrics Retrieved:`);
        console.log(`     Total Disputes:  ${metrics.totalDisputes}`);
        console.log(`     Pending Cases:   ${metrics.pendingDisputes}`);
        console.log(`     Revenue at Risk: ${metrics.totalAtRiskFormatted}`);
        // 4. Fetch Dispute Ledger
        console.log("\n-> 3. Fetching Dispute Ledger for Data Table...");
        const ledgerRes = await fetch('http://localhost:3000/api/dashboard/disputes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const { disputes } = await ledgerRes.json();
        console.log(`[✅] Ledger Retrieved: Found ${disputes.length} records.`);
    }
    catch (err) {
        console.error("\n[❌] Audit Failed:", err);
    }
    finally {
        await prisma.$disconnect();
        index_1.server.close();
        process.exit(0);
    }
}
setTimeout(runAudit, 1000);
