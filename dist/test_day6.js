"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const index_1 = require("./index");
const prisma = new client_1.PrismaClient();
async function runAudit() {
    console.log("\n[🔒] Running Whop Webhook Simulation...\n");
    try {
        const org = await prisma.organization.findFirst();
        if (!org)
            throw new Error("No test organization found in database.");
        console.log(`-> Target Organization: ${org.id}`);
        // Force tier to INACTIVE to ensure our test actually works
        await prisma.organization.update({
            where: { id: org.id },
            data: { tier: 'INACTIVE' }
        });
        console.log("-> State reset: Organization is INACTIVE.");
        // The exact JSON structure Whop will send your server
        const simulatedPayload = {
            action: 'membership.went_valid',
            data: {
                id: 'sub_whop_999888',
                metadata: { organizationId: org.id }
            }
        };
        console.log("\n-> Firing simulated Whop payload to /api/webhooks/whop...");
        const res = await fetch('http://localhost:3000/api/webhooks/whop', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-whop-signature': 'simulated_signature_hash'
            },
            body: JSON.stringify(simulatedPayload)
        });
        if (!res.ok)
            throw new Error(`Webhook rejected with status: ${res.status}`);
        // Verify the database recorded the change
        const updatedOrg = await prisma.organization.findUnique({ where: { id: org.id } });
        if (updatedOrg?.tier === 'PRO' && updatedOrg?.whopSubscriptionId === 'sub_whop_999888') {
            console.log("\n[✅] SUCCESS: Webhook received. Database tier automatically upgraded to PRO.");
        }
        else {
            console.log("\n[❌] FAILURE: Database tier was not updated.");
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
