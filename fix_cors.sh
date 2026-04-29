#!/bin/bash

echo "[🔧] Engineering correction: Expanding CORS firewall to allow port 3001..."

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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet()); 

// THE CRITICAL FIX: Allowing both 3000 and the new frontend on 3001
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3001'] }));

app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeRoutes);

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/organizations', orgRoutes);
app.use('/api/webhooks/whop', webhookRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'Jade Dynasty Engine Online.' });
});

export const server = app.listen(PORT, () => {
    console.log(`[🚀] Server running on port ${PORT}`);
});
CODE

echo "[✅] Firewall updated. Rebooting Backend Engine..."
npm run dev
