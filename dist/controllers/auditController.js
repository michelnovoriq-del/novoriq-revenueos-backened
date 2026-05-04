"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBleedReport = void 0;
const stripe_1 = __importDefault(require("stripe"));
const generateBleedReport = async (req, res) => {
    try {
        const { stripeSecretKey } = req.body;
        if (!stripeSecretKey) {
            res.status(400).json({ error: "Stripe key is required for the forensic audit." });
            return;
        }
        // Initialize Stripe in-memory
        const stripe = new stripe_1.default(stripeSecretKey, { apiVersion: '2026-04-22.dahlia' });
        // Fetch the last 50 disputes
        const disputes = await stripe.disputes.list({
            limit: 50,
            expand: ['data.charge']
        });
        let totalLostCents = 0;
        const formattedDisputes = disputes.data.map(d => {
            const amount = d.amount || 0;
            totalLostCents += amount;
            return {
                id: d.id,
                amountFormatted: `$${(amount / 100).toFixed(2)}`,
                reason: d.reason,
                status: d.status,
                created: new Date(d.created * 1000).toLocaleDateString()
            };
        });
        res.json({
            success: true,
            totalLostFormatted: `$${(totalLostCents / 100).toFixed(2)}`,
            disputeCount: disputes.data.length,
            disputes: formattedDisputes,
            securityNote: "Stateless audit complete. Key discarded."
        });
    }
    catch (error) {
        res.status(400).json({ error: "Invalid Stripe Key or insufficient permissions." });
    }
};
exports.generateBleedReport = generateBleedReport;
