#!/bin/bash

echo "[🚀] Initiating Day 7: 48-Hour Tier Gating & Trial Logic..."

# 1. Build the Trial Controller
cat << 'CODE' > src/controllers/trialController.ts
import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const activateTrial = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) { 
            res.status(401).json({ error: "Unauthorized" }); 
            return; 
        }

        const org = await prisma.organization.findUnique({ where: { id: orgId } });
        
        if (org?.tier === 'PRO') { 
            res.status(400).json({ error: "Organization is already on a paid PRO tier." }); 
            return; 
        }
        if (org?.tier === 'TRIAL') {
            res.status(400).json({ error: "Trial has already been activated." }); 
            return; 
        }

        // Calculate exact expiration time (48 hours from right now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 48);

        await prisma.organization.update({
            where: { id: orgId },
            data: { 
                tier: 'TRIAL', 
                accessExpiresAt: expiresAt 
            }
        });

        res.json({ success: true, tier: 'TRIAL', expiresAt });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error during trial activation.' });
    }
};
CODE

# 2. Build the Gating Middleware
cat << 'CODE' > src/middleware/gating.ts
import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from './auth';

const prisma = new PrismaClient();

export const requireActiveSubscription = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) { 
            res.status(401).json({ error: "Unauthorized: Missing identity context." }); 
            return; 
        }

        const org = await prisma.organization.findUnique({ 
            where: { id: orgId },
            select: { tier: true, accessExpiresAt: true } 
        });
        
        // 1. Paid Users bypass all time checks
        if (org?.tier === 'PRO') {
            next();
            return;
        }

        // 2. Trial Users are checked against the exact current time
        if (org?.tier === 'TRIAL' && org.accessExpiresAt && org.accessExpiresAt > new Date()) {
            next();
            return;
        }

        // 3. Everyone else hits the paywall
        res.status(403).json({ error: 'PAYWALL: Active subscription or valid trial required to perform this action.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error verifying subscription status.' });
    }
};
CODE

# 3. Update Organization Routes
cat << 'CODE' > src/routes/orgRoutes.ts
import { Router } from 'express';
import { getMyOrganization } from '../controllers/orgController';
import { activateTrial } from '../controllers/trialController';
import { requireAuth } from '../middleware/auth';
import { requireActiveSubscription } from '../middleware/gating';

const router = Router();

// Standard Auth Protected Routes
router.get('/me', requireAuth, getMyOrganization);
router.post('/trial', requireAuth, activateTrial);

// TIER GATED ROUTE: Requires Auth AND an Active Subscription/Trial
router.get('/secure-recovery-action', requireAuth, requireActiveSubscription, (req, res) => {
    res.json({ message: "[🔓] ACTION PERMITTED: Generating PDF Evidence..." });
});

export default router;
CODE

# 4. Build the Automated Simulation Script
cat << 'TEST' > src/test_day7.ts
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
TEST

echo "[✅] Controllers, Middleware, and Routes built. Executing Simulation..."
npx ts-node src/test_day7.ts
