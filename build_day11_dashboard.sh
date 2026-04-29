#!/bin/bash

echo "[🚀] Initiating Day 11: The Dashboard API (Jade Dynasty Protocol)..."

# 1. Build the Dashboard Controller
cat << 'CODE' > src/controllers/dashboardController.ts
import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { encryptStripeKey } from '../utils/encryption';

const prisma = new PrismaClient();

export const connectStripeKey = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const orgId = req.user?.organizationId;
        const { stripeSecretKey } = req.body;

        if (!stripeSecretKey || !stripeSecretKey.startsWith('sk_')) {
            res.status(400).json({ error: "Invalid Stripe Secret Key format." });
            return;
        }

        // Encrypt the key in memory before it ever touches the database
        const { encryptedStripeKey, stripeKeyIv } = encryptStripeKey(stripeSecretKey);

        await prisma.organization.update({
            where: { id: orgId },
            data: { encryptedStripeKey, stripeKeyIv }
        });

        res.json({ success: true, message: "[🔒] Stripe key encrypted and locked in the Vault." });
    } catch (error) {
        console.error("Encryption/Save Error:", error);
        res.status(500).json({ error: "Failed to secure Stripe keys." });
    }
};

export const getMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const orgId = req.user?.organizationId;

        const totalDisputes = await prisma.dispute.count({ where: { organizationId: orgId } });
        const pendingDisputes = await prisma.dispute.count({ 
            where: { organizationId: orgId, status: 'needs_response' } 
        });

        // Sum the amounts of payments tied to disputes
        const disputesWithPayments = await prisma.dispute.findMany({
            where: { organizationId: orgId },
            include: { payment: true }
        });

        const totalAtRiskCents = disputesWithPayments.reduce((sum, d) => sum + d.payment.amount, 0);

        res.json({
            metrics: {
                totalDisputes,
                pendingDisputes,
                totalAtRiskFormatted: `$${(totalAtRiskCents / 100).toFixed(2)}`
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch metrics." });
    }
};

export const getDisputes = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const orgId = req.user?.organizationId;

        const disputes = await prisma.dispute.findMany({
            where: { organizationId: orgId },
            include: { payment: true },
            orderBy: { createdAt: 'desc' },
            take: 50 // Pagination limit for UI performance
        });

        res.json({ disputes });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch disputes ledger." });
    }
};
CODE

# 2. Build the Dashboard Routes
cat << 'CODE' > src/routes/dashboardRoutes.ts
import { Router } from 'express';
import { connectStripeKey, getMetrics, getDisputes } from '../controllers/dashboardController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// All dashboard routes require the user to be logged in (JWT)
router.post('/keys', requireAuth, connectStripeKey);
router.get('/metrics', requireAuth, getMetrics);
router.get('/disputes', requireAuth, getDisputes);

export default router;
CODE

# 3. Wire into Master Server
cat << 'CODE' > src/index.ts
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import orgRoutes from './routes/orgRoutes';
import webhookRoutes from './routes/webhookRoutes';
import stripeRoutes from './routes/stripeRoutes';
import dashboardRoutes from './routes/dashboardRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet()); 
app.use(cors({ origin: 'http://localhost:3000' }));

// Stripe Raw Pipeline
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeRoutes);

// Standard JSON Pipeline
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/organizations', orgRoutes);
app.use('/api/webhooks/whop', webhookRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'Novoriq OS is running securely.' });
});

export const server = app.listen(PORT, () => {
    console.log(`[🚀] Server running on port ${PORT}`);
});
CODE

# 4. Build the Automated Simulation
cat << 'TEST' > src/test_day11.ts
import { PrismaClient } from '@prisma/client';
import { server } from './index';

const prisma = new PrismaClient();

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
        if (!token) throw new Error("Failed to authenticate.");

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

echo "[✅] Dashboard APIs built. Executing Simulation..."
npx ts-node src/test_day11.ts
