#!/bin/bash

echo "[🔧] Engineering correction: Fixing Express route handler signature..."

cat << 'CODE' > src/webhooks/stripeWebhook.ts
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// FIX: Removed the 3rd argument (orgId) to comply with Express.js
export const handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
        // FIX: Extract orgId directly from the URL route parameters
        const orgId = req.params.organizationId;
        
        if (!orgId) {
            res.status(400).send("Organization ID missing in URL.");
            return;
        }

        const org = await prisma.organization.findUnique({ where: { id: orgId } });
        if (!org || !org.encryptedStripeKey) { res.status(400).send("Org not found or missing keys."); return; }

        const event = req.body as Stripe.Event;

        // ==========================================
        // NEW: PRE-INGESTION ENGINE (Records ALL transactions)
        // ==========================================
        if (event.type === 'charge.succeeded') {
            const charge = event.data.object as Stripe.Charge;
            
            const name = charge.billing_details?.name || 'Unknown';
            const email = charge.billing_details?.email || 'Unknown';
            const addressObj = charge.billing_details?.address;
            const address = addressObj ? `${addressObj.line1}, ${addressObj.city}, ${addressObj.country} ${addressObj.postal_code}` : 'No Address Provided';
            
            let ipAddress = charge.metadata?.ip_address || null;
            let geoData = address;

            if (ipAddress && process.env.IPAPI_API) {
                try {
                    const geoRes = await axios.get(`https://ipapi.co/${ipAddress}/json/?key=${process.env.IPAPI_API}`);
                    if (geoRes.data && !geoRes.data.error) {
                        geoData = `${geoRes.data.city}, ${geoRes.data.region}, ${geoRes.data.country_name} (IP Tracked)`;
                    }
                } catch (e) { console.error("IPAPI Lookup Failed."); }
            }

            await prisma.preRecordedEvidence.upsert({
                where: { stripeChargeId: charge.id },
                update: { customerName: name, customerEmail: email, billingAddress: address, ipAddress, geoData },
                create: { stripeChargeId: charge.id, organizationId: orgId, customerName: name, customerEmail: email, billingAddress: address, ipAddress, geoData }
            });

            console.log(`[📦] Transaction Pre-Recorded | Charge: ${charge.id} | Org: ${orgId}`);
        }

        // ==========================================
        // EXISTING: DISPUTE INGESTION
        // ==========================================
        if (event.type === 'charge.dispute.created') {
            const dispute = event.data.object as Stripe.Dispute;
            console.log(`[🚨] DISPUTE DETECTED: ${dispute.id} for Org ${orgId}`);
        }

        res.json({ received: true });
    } catch (err) {
        console.error("Stripe Webhook Error:", err);
        res.status(400).send(`Webhook Error`);
    }
};
CODE

echo "[✅] Signature patched. Booting backend server..."
npm run dev
