"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const pdfService_1 = require("./services/pdfService");
const fs_1 = __importDefault(require("fs"));
const prisma = new client_1.PrismaClient();
async function runAudit() {
    console.log("\n[🔒] Running Evidence PDF Factory Simulation...\n");
    try {
        // 1. Fetch the dispute we generated in Day 8
        const dispute = await prisma.dispute.findFirst({
            include: {
                payment: true,
                organization: true
            }
        });
        if (!dispute) {
            throw new Error("No dispute found in database. Run Day 8 simulation first.");
        }
        console.log(`-> Extracting data for Dispute: ${dispute.stripeId}`);
        // 2. Format data for the PDF engine
        const evidenceData = {
            disputeId: dispute.stripeId,
            chargeId: dispute.payment.stripeChargeId,
            amount: dispute.payment.amount,
            reason: dispute.reason,
            date: dispute.payment.createdAt.toISOString().split('T')[0],
            organizationName: dispute.organization.name,
            // 🚨 ADDED TO FIX THE TS ERROR:
            customerName: 'Simulated User',
            customerEmail: 'simulated@example.com'
        };
        console.log("-> Launching Headless Browser (Puppeteer)...");
        const pdfPath = await (0, pdfService_1.generateCompellingEvidence)(evidenceData);
        // 3. Verify the file exists on the hard drive
        if (fs_1.default.existsSync(pdfPath)) {
            console.log(`\n[✅] SUCCESS: Compelling Evidence PDF successfully generated.`);
            console.log(`     File Location: ${pdfPath}`);
        }
        else {
            console.log("\n[❌] FAILURE: PDF file not found at expected path.");
        }
    }
    catch (err) {
        console.error("\n[❌] Audit Failed:", err);
    }
    finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}
setTimeout(runAudit, 1000);
