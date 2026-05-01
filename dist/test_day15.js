"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const index_1 = require("./index");
const worker_1 = require("./services/worker");
const prisma = new client_1.PrismaClient();
async function runAudit() {
    console.log("\n[🔒] Running Golden Trio & Asset Delivery Audit...\n");
    try {
        const org = await prisma.organization.findFirst();
        const mockChargeId = `ch_trio_${Date.now()}`;
        const mockStripeId = `dp_trio_${Date.now()}`;
        // 1. Simulate Charge Succeeded Webhook (with Golden Trio Metadata)
        console.log("-> 1. Firing charge.succeeded webhook (Google DNS IP injected)...");
        await fetch(`http://localhost:3000/api/webhooks/stripe/${org.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'charge.succeeded',
                data: { object: {
                        id: mockChargeId, amount: 9900, status: 'succeeded',
                        metadata: { customer_ip: '8.8.8.8', device_fingerprint: 'fp_a1b2c3d4' }
                    } }
            })
        });
        // Give IP-API a moment to resolve
        await new Promise(r => setTimeout(r, 1500));
        // 2. Simulate Dispute Created Webhook
        console.log("-> 2. Firing charge.dispute.created webhook...");
        await fetch(`http://localhost:3000/api/webhooks/stripe/${org.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'charge.dispute.created',
                data: { object: { id: mockStripeId, charge: mockChargeId, reason: 'unrecognized' } }
            })
        });
        // 3. Process PDF via Worker
        console.log("-> 3. Triggering Worker to compile Evidence PDF...");
        await (0, worker_1.processQueue)();
        const dispute = await prisma.dispute.findUnique({ where: { stripeId: mockStripeId } });
        // 4. Test Secure Download Route
        console.log("-> 4. Testing Secure PDF Download Route...");
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@novoriq.local', password: 'admin123!' })
        });
        const { token } = await loginRes.json();
        const downloadRes = await fetch(`http://localhost:3000/api/dashboard/disputes/${dispute.id}/pdf`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (downloadRes.ok) {
            const contentType = downloadRes.headers.get('content-type');
            console.log(`[✅] Asset Delivery Confirmed. Received content type: ${contentType}`);
        }
        else {
            throw new Error("Download route rejected the request.");
        }
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
