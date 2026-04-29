#!/bin/bash

echo "[🚀] Initiating Day 23: The Golden Trio API (IP, Geo, Fingerprint)..."

# 1. Expand the Database Schema to store Tracking Intel
echo "[🔧] Upgrading Prisma Schema..."
cat << 'SCHEMA' >> prisma/schema.prisma

model TrackingIntel {
  id                String   @id @default(uuid())
  stripeSessionId   String   @unique
  ipAddress         String
  geolocation       String?
  deviceFingerprint String
  createdAt         DateTime @default(now())
}
SCHEMA

# Push the new table to your local database
npx prisma db push

# 2. Build the Tracking Controller
echo "[🔧] Building Tracking Controller..."
cat << 'CODE' > src/controllers/trackingController.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const ingestTrackingData = async (req: Request, res: Response): Promise<void> => {
    try {
        const { stripeSessionId, deviceFingerprint } = req.body;
        
        if (!stripeSessionId || !deviceFingerprint) {
            res.status(400).json({ error: "Missing required tracking parameters." }); 
            return;
        }

        // 1. Extract IP Address securely
        let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
        if (Array.isArray(ip)) ip = ip[0];
        
        // Mock IP for local testing (localhost returns ::1, which breaks geo-lookups)
        if (ip === '::1' || ip === '127.0.0.1') ip = '8.8.8.8'; 

        // 2. Fetch Geolocation from ipapi.co
        let geolocation = 'Unknown / Encrypted';
        try {
            console.log(`[🌍] Pinging ipapi.co for IP: ${ip}...`);
            const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
            const geoData = await geoRes.json();
            
            if (geoData && !geoData.error) {
                geolocation = `${geoData.city}, ${geoData.region}, ${geoData.country_name} (Zip: ${geoData.postal})`;
            }
        } catch (error) {
            console.error("[⚠️] Geolocation lookup failed, saving raw IP.");
        }

        // 3. Lock the Golden Trio into the Database
        const intel = await prisma.trackingIntel.upsert({
            where: { stripeSessionId },
            update: { ipAddress: ip as string, geolocation, deviceFingerprint },
            create: { stripeSessionId, ipAddress: ip as string, geolocation, deviceFingerprint }
        });

        console.log(`[🎯] Golden Trio Secured | Session: ${stripeSessionId.substring(0, 10)}... | Geo: ${geolocation}`);
        
        res.status(200).json({ success: true, message: "Intel secured." });
    } catch (error) {
        console.error("[CRITICAL] Tracking ingestion failed:", error);
        res.status(500).json({ error: "System fault." });
    }
};
CODE

# 3. Create the Tracking Routes
cat << 'CODE' > src/routes/trackingRoutes.ts
import { Router } from 'express';
import { ingestTrackingData } from '../controllers/trackingController';

const router = Router();

// Endpoint for the merchant's website to post data to
router.post('/', ingestTrackingData);

export default router;
CODE

# 4. Wire the Route into the Master API Engine
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
import adminRoutes from './routes/adminRoutes';
import trackingRoutes from './routes/trackingRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet()); 

// Allowed origins: Frontend, Localhost, and any Merchant Website embedding the tracking script
app.use(cors({ origin: '*' }));

app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeRoutes);

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/organizations', orgRoutes);
app.use('/api/webhooks/whop', webhookRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/track', trackingRoutes); // <-- The Golden Trio Ingestion Endpoint

app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'Jade Dynasty Engine Online.' });
});

export const server = app.listen(PORT, () => {
    console.log(`[🚀] Server running on port ${PORT}`);
});
CODE

echo "[✅] Golden Trio APIs deployed. Booting backend server..."
npm run dev
