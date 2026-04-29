import { PrismaClient } from '@prisma/client';
import { server } from './index';

const prisma = new PrismaClient();

async function runAudit() {
    console.log("\n[🔒] Running 48-Hour Trial & Gating Simulation...\n");

    try {
        // 1. Reset state and Login
        const org = await prisma.organization.findFirst();
        await prisma.organization.update({
            where: { id: org!.id },
            data: { tier: 'INACTIVE', accessExpiresAt: null }
        });

        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@novoriq.local', password: 'admin123!' })
        });
        const { token } = await loginRes.json();

        // 2. Test INACTIVE access (Should hit paywall)
        console.log("-> 1. Attempting secure action as INACTIVE user...");
        const res1 = await fetch('http://localhost:3000/api/organizations/secure-recovery-action', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res1.status === 403) console.log("[✅] Paywall correctly blocked INACTIVE user.");

        // 3. Activate Trial
        console.log("\n-> 2. Activating 48-Hour Trial...");
        const trialRes = await fetch('http://localhost:3000/api/organizations/trial', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const trialData = await trialRes.json();
        console.log(`[✅] Trial active. Expires at: ${trialData.expiresAt}`);

        // 4. Test TRIAL access (Should permit)
        console.log("\n-> 3. Attempting secure action as TRIAL user...");
        const res2 = await fetch('http://localhost:3000/api/organizations/secure-recovery-action', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data2 = await res2.json();
        console.log(`[✅] Access Granted: ${data2.message}`);

        // 5. Time Travel (Simulate 48 hours passing by expiring the DB record)
        console.log("\n-> 4. Simulating time travel: Fast-forwarding 48 hours...");
        const pastDate = new Date();
        pastDate.setHours(pastDate.getHours() - 1); // Set to 1 hour ago
        await prisma.organization.update({
            where: { id: org!.id },
            data: { accessExpiresAt: pastDate }
        });

        // 6. Test EXPIRED access (Should hit paywall)
        console.log("\n-> 5. Attempting secure action after 48 hours...");
        const res3 = await fetch('http://localhost:3000/api/organizations/secure-recovery-action', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res3.status === 403) {
            const data3 = await res3.json();
            console.log(`[✅] Paywall correctly blocked expired trial. Reason: ${data3.error}`);
        } else {
            throw new Error("Paywall failed to block expired trial!");
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
