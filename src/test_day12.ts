import { PrismaClient } from '@prisma/client';
import { server } from './index';
import { processQueue } from './services/worker';

const prisma = new PrismaClient();

async function runAudit() {
    console.log("\n[🔒] Running Worker Queue Simulation...\n");

    try {
        const org = await prisma.organization.findFirst();
        const mockChargeId = `ch_worker_${Date.now()}`;
        const mockStripeId = `dp_worker_${Date.now()}`;

        await prisma.payment.create({
            data: { stripeChargeId: mockChargeId, amount: 5000, status: 'succeeded', organizationId: org!.id }
        });

        // Fire webhook
        await fetch(`http://localhost:3000/api/webhooks/stripe/${org!.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'charge.dispute.created', data: { object: { id: mockStripeId, charge: mockChargeId, reason: 'fraudulent' } } })
        });

        console.log("-> Webhook fired. Checking database for PENDING status...");
        const pending = await prisma.dispute.findUnique({ where: { stripeId: mockStripeId } });
        console.log(`   Status: ${pending?.processingStatus}`);

        console.log("-> Manually triggering Worker cycle...");
        await processQueue();

        const completed = await prisma.dispute.findUnique({ where: { stripeId: mockStripeId } });
        console.log(`   Final Status: ${completed?.processingStatus}`);
        console.log(`   PDF URL: ${completed?.evidencePdfUrl ? 'VALID' : 'MISSING'}`);

    } catch (err) {
        console.error(err);
    } finally {
        server.close();
        process.exit(0);
    }
}

setTimeout(runAudit, 1000);
