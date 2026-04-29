import { PrismaClient } from '@prisma/client';
import { server } from './index';

const prisma = new PrismaClient();

async function runAudit() {
    console.log("\n[🔒] Running Stripe Event Ingestion Audit...\n");

    try {
        const org = await prisma.organization.findFirst();
        if (!org) throw new Error("No test organization found.");

        // 1. Prepare Database: Inject a dummy successful payment
        const mockChargeId = `ch_test_${Date.now()}`;
        const payment = await prisma.payment.create({
            data: {
                stripeChargeId: mockChargeId,
                amount: 9900, // $99.00
                status: 'succeeded',
                organizationId: org.id
            }
        });
        console.log(`-> 1. Payment Database Seeded: ${mockChargeId}`);

        // 2. Simulate the exact JSON structure of a Stripe 'charge.dispute.created' event
        const mockStripeId = `dp_test_${Date.now()}`;
        const stripePayload = {
            id: "evt_test_123",
            type: "charge.dispute.created",
            data: {
                object: {
                    id: mockStripeId,
                    charge: mockChargeId,
                    reason: "fraudulent",
                    status: "needs_response"
                }
            }
        };

        // 3. Fire the payload at the RAW endpoint
        console.log(`-> 2. Firing RAW Stripe payload to /api/webhooks/stripe/${org.id}...`);
        const res = await fetch(`http://localhost:3000/api/webhooks/stripe/${org.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stripePayload) // sent as string, received as raw buffer
        });

        if (!res.ok) throw new Error("Webhook rejected.");

        // 4. Verify the dispute was written to PostgreSQL
        const dispute = await prisma.dispute.findUnique({ where: { stripeId: mockStripeId } });
        
        if (dispute && dispute.organizationId === org.id) {
            console.log(`\n[✅] SUCCESS: Engine successfully caught and mapped the Stripe dispute.`);
            console.log(`     Dispute ID: ${dispute.id}`);
        } else {
            console.log("\n[❌] FAILURE: Dispute was not found in the database.");
        }

    } catch (err) {
        console.error("\n[❌] Audit Failed:", err);
    } finally {
        await prisma.$disconnect();
        server.close();
        process.exit(0);
    }
}

setTimeout(runAudit, 1000);
