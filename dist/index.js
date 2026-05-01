"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const orgRoutes_1 = __importDefault(require("./routes/orgRoutes"));
const webhookRoutes_1 = __importDefault(require("./routes/webhookRoutes"));
const stripeRoutes_1 = __importDefault(require("./routes/stripeRoutes"));
const dashboardRoutes_1 = __importDefault(require("./routes/dashboardRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const trackingRoutes_1 = __importDefault(require("./routes/trackingRoutes"));
const promoRoutes_1 = __importDefault(require("./routes/promoRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, helmet_1.default)());
// Allowed origins: Frontend, Localhost, and any Merchant Website embedding the tracking script
const allowedOrigins = [
    'http://localhost:3000', // [CODEX PATCH]
    process.env.FRONTEND_URL || 'https://novoriq-dashboard.netlify.app', // [CODEX PATCH]
]; // [CODEX PATCH]
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin))
            return callback(null, true); // [CODEX PATCH]
        return callback(new Error('CORS origin denied by Revenue OS policy')); // [CODEX PATCH]
    }, // [CODEX PATCH]
    credentials: true, // [CODEX PATCH]
})); // [CODEX PATCH]
// 1. STRIPE RAW EXEMPTION (Runs first to completely bypass JSON parsing for Stripe)
app.use('/api/webhooks/stripe', express_1.default.raw({ type: 'application/json' }), stripeRoutes_1.default);
// 2. UNIVERSAL RAW BODY BUFFER FIX (For Whop and everything else)
app.use(express_1.default.json({
    verify: (req, res, buf) => {
        req.rawBody = buf; // Saves the exact incoming bytes before Express touches them
    }
}));
app.use('/api/auth', authRoutes_1.default);
app.use('/api/organizations', orgRoutes_1.default);
app.use('/api/webhooks', webhookRoutes_1.default);
app.use('/api/dashboard', dashboardRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.use('/api/track', trackingRoutes_1.default);
app.use('/api/promo', promoRoutes_1.default);
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'Jade Dynasty Engine Online.' });
});
exports.server = app.listen(PORT, () => {
    console.log(`[🚀] Server running on port ${PORT}`);
});
