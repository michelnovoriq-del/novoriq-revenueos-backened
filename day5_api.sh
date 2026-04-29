#!/bin/bash

echo "[🚀] Initiating Day 5: API Entry Points & Security Audit..."

# 1. Create the Auth Controller & Routes
cat << 'CODE' > src/controllers/authController.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;
        
        // Find the user
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) { 
            res.status(401).json({ error: 'Invalid credentials' }); 
            return; 
        }

        // Verify the hash
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) { 
            res.status(401).json({ error: 'Invalid credentials' }); 
            return; 
        }

        // Generate the VIP Pass (JWT)
        const token = jwt.sign(
            { userId: user.id, organizationId: user.organizationId, role: user.role },
            process.env.JWT_SECRET as string,
            { expiresIn: '24h' }
        );

        res.json({ token, organizationId: user.organizationId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
CODE

cat << 'CODE' > src/routes/authRoutes.ts
import { Router } from 'express';
import { login } from '../controllers/authController';

const router = Router();
router.post('/login', login);

export default router;
CODE

# 2. Create the Organization Controller & Routes
cat << 'CODE' > src/controllers/orgController.ts
import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const getMyOrganization = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        // The organizationId is safely injected by our Auth Middleware, NEVER by the user!
        const orgId = req.user?.organizationId;
        
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            // SECURITY: Never select the encryptedStripeKey here!
            select: { id: true, name: true, tier: true, createdAt: true } 
        });
        
        res.json({ organization: org });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
CODE

cat << 'CODE' > src/routes/orgRoutes.ts
import { Router } from 'express';
import { getMyOrganization } from '../controllers/orgController';
import { requireAuth } from '../middleware/auth';

const router = Router();
// We protect this route with the requireAuth middleware
router.get('/me', requireAuth, getMyOrganization);

export default router;
CODE

# 3. Update index.ts to wire up the new routes and export the server for testing
cat << 'CODE' > src/index.ts
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import orgRoutes from './routes/orgRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet()); 
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// Wire the routes
app.use('/api/auth', authRoutes);
app.use('/api/organizations', orgRoutes);

app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'Novoriq OS is running securely.' });
});

export const server = app.listen(PORT, () => {
    console.log(`[🚀] Server running on port ${PORT}`);
});
CODE

# 4. Create the automated network test script
cat << 'TEST' > src/test_day5.ts
import { server } from './index';

async function runAudit() {
    console.log("\n[🔒] Running Network & Security Audit...\n");

    try {
        // 1. Simulate frontend login
        console.log("-> Attempting Login as admin@novoriq.local...");
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@novoriq.local', password: 'admin123!' })
        });
        
        const loginData = await loginRes.json();
        
        if (!loginData.token) {
            throw new Error("Failed to receive JWT from login route.");
        }
        console.log("[✅] Login Successful. JWT Received.");

        // 2. Fetch protected organization data
        console.log("\n-> Fetching secure Organization data using JWT...");
        const orgRes = await fetch('http://localhost:3000/api/organizations/me', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${loginData.token}` }
        });

        const orgData = await orgRes.json();
        console.log("[✅] Protected Data Accessed:");
        console.log(orgData);

    } catch (err) {
        console.error("\n[❌] Audit Failed:", err);
    } finally {
        // Shut down the server to free up the port
        server.close();
        process.exit(0);
    }
}

// Give the server 1 second to fully boot, then run the audit
setTimeout(runAudit, 1000);
TEST

echo "[✅] Controllers and Routes built. Running automated network audit..."
npx ts-node src/test_day5.ts
