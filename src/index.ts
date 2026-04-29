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
import promoRoutes from './routes/promoRoutes'; 

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet()); 

// Allowed origins: Frontend, Localhost, and any Merchant Website embedding the tracking script
app.use(cors({ origin: '*' }));

// 1. STRIPE RAW EXEMPTION (Runs first to completely bypass JSON parsing for Stripe)
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeRoutes);

// 2. UNIVERSAL RAW BODY BUFFER FIX (For Whop and everything else)
app.use(express.json({
    verify: (req: any, res, buf) => {
        req.rawBody = buf; // Saves the exact incoming bytes before Express touches them
    }
}));

app.use('/api/auth', authRoutes);
app.use('/api/organizations', orgRoutes);
app.use('/api/webhooks', webhookRoutes); 
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/track', trackingRoutes); 
app.use('/api/promo', promoRoutes); 

app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'Jade Dynasty Engine Online.' });
});

export const server = app.listen(PORT, () => {
    console.log(`[🚀] Server running on port ${PORT}`);
});