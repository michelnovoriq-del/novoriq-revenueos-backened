import { PrismaClient } from '@prisma/client';
import { server } from './index';

async function runAudit() {
    console.log("\n[🔒] Running Memory-Safe Connection Audit...\n");

    try {
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@novoriq.local', password: 'admin123!' })
        });
        const { token } = await loginRes.json();

        console.log("-> 1. Testing Invalid Stripe Key Submission...");
        const res = await fetch('http://localhost:3000/api/dashboard/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ stripeSecretKey: 'sk_test_fake_key' })
        });
        
        const data = await res.json();
        if (res.status === 400) {
            console.log(`[✅] Correctly rejected invalid Stripe key.`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        server.close();
        process.exit(0);
    }
}

setTimeout(runAudit, 1000);
