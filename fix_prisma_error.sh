#!/bin/bash

echo "[🔧] Fixing Prisma Client TypeScript Error..."

# 1. Force a clean install and generation of the Prisma Client
npm install @prisma/client
npx prisma generate

# 2. Rewrite the FULL authController.ts file
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

# 3. Rewrite the FULL orgController.ts file
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

echo "[✅] Files completely rewritten and Prisma client regenerated."
echo "[🔒] Re-running automated network audit..."
npx ts-node src/test_day5.ts
