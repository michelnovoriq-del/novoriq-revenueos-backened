"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const index_1 = require("./index");
const fs_1 = __importDefault(require("fs"));
const prisma = new client_1.PrismaClient();
async function runAudit() {
    console.log("\n[🔒] Running Full E2E Pipeline Simulation...\n");
    try {
        const org = await prisma.organization.findFirst();
        if (!org)
            throw new Error("No test organization found.");
        const uniqueSuffix = Date.now();
        const mockChargeId = `ch_live_${uniqueSuffix}`;
        const mockStripeId = `dp_live_${uniqueSuffix}`;
        // 1. Seed a payment
        await prisma.payment.create({
            data: {
                stripeChargeId: mockChargeId,
                amount: 14900, // $149.00
                status: 'succeeded',
                organizationId: org.id
            }
        });
        const stripePayload = {
            id: `evt_${uniqueSuffix}`,
            type: "charge.dispute.created",
            data: {
                object: {
                    id: mockStripeId,
                    charge: mockChargeId,
                    reason: "product_not_received",
                    status: "needs_response"
                }
            }
        };
        // 2. Fire the webhook
        console.log(`-> Firing Webhook to /api/webhooks/stripe/${org.id}...`);
        const res = await fetch(`http://localhost:3000/api/webhooks/stripe/${org.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stripePayload)
        });
        if (!res.ok)
            throw new Error("Webhook rejected.");
        // Wait 3 seconds to give Puppeteer time to render and save the PDF
        console.log("-> Awaiting Puppeteer rendering engine (3 seconds)...");
        await new Promise(resolve => setTimeout(resolve, 3000));
        // 3. Verify Database and File System
        const finalDispute = await prisma.dispute.findUnique({ where: { stripeId: mockStripeId } });
        if (finalDispute && finalDispute.evidencePdfUrl) {
            if (fs_1.default.existsSync(finalDispute.evidencePdfUrl)) {
                console.log(`\n[✅] PIPELINE SUCCESS: Webhook received, database updated, and PDF verified on disk.`);
                console.log(`     Final File: ${finalDispute.evidencePdfUrl}`);
            }
            else {
                console.log("\n[❌] PIPELINE FAILURE: Database updated, but PDF file is missing from disk.");
            }
        }
        else {
            console.log("\n[❌] PIPELINE FAILURE: Dispute not logged or PDF URL not saved.");
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
