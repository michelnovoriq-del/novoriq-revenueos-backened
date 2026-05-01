"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyStripeConnection = exports.getStripeClientForOrg = void 0;
const stripe_1 = __importDefault(require("stripe"));
const client_1 = require("@prisma/client");
const encryption_1 = require("../utils/encryption");
const prisma = new client_1.PrismaClient();
// Changed Promise<Stripe> to Promise<any> to bypass the strict namespace error
const getStripeClientForOrg = async (organizationId) => {
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { encryptedStripeKey: true, stripeKeyIv: true }
    });
    if (!org || !org.encryptedStripeKey || !org.stripeKeyIv) {
        throw new Error("Stripe keys not configured for this organization.");
    }
    // Just-In-Time Decryption
    const decryptedKey = (0, encryption_1.decryptStripeKey)(org.encryptedStripeKey, org.stripeKeyIv);
    // Initialize client and return it. 
    return new stripe_1.default(decryptedKey, {
        apiVersion: '2025-01-27',
    });
};
exports.getStripeClientForOrg = getStripeClientForOrg;
const verifyStripeConnection = async (organizationId) => {
    try {
        const stripe = await (0, exports.getStripeClientForOrg)(organizationId);
        // Use the balance endpoint. It requires zero arguments and verifies key authenticity.
        const balance = await stripe.balance.retrieve();
        return !!balance.object;
    }
    catch (error) {
        console.error("[❌] Stripe Verification Failed:", error.message);
        return false;
    }
};
exports.verifyStripeConnection = verifyStripeConnection;
