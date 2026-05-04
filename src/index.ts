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
import billingRoutes from './routes/billingRoutes';
import auditRoutes from './routes/auditRoutes'; // [NEW] Import audit routes

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet()); 

// [UPDATED] Added your new separate landing page URL to CORS
const allowedOrigins = [
    'http://localhost:3000',
    'https://novoriqrevenueos.netlify.app', 
    'https://novoriq-dashboard.netlify.app', 
    'https://novoriqrevenueosapi.onrender.com',
    'https://your-new-landing-page.netlify.app' // [FIX] Add your separate marketing app URL here
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.error(`[CORS Blocked] Unauthorized origin: ${origin}`);
            callback(new Error('CORS origin denied by Revenue OS policy'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-whop-signature',
        'webhook-id',
        'webhook-signature',
        'webhook-timestamp'
    ]
}));

// 1. STRIPE RAW EXEMPTION
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeRoutes);

// 2. UNIVERSAL RAW BODY BUFFER FIX
app.use(express.json({
    verify: (req: any, res, buf) => {
        req.rawBody = buf; 
    }
}));

app.use('/api/auth', authRoutes);
app.use('/api/organizations', orgRoutes);
app.use('/api/webhooks', webhookRoutes); 
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/track', trackingRoutes); 
app.use('/api/promo', promoRoutes); 
app.use('/api/audit', auditRoutes); // [NEW] Public audit endpoint

app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'Jade Dynasty Engine Online.' });
});

export const server = app.listen(PORT, () => {
    console.log(`[🚀] Server running on port ${PORT}`);
});