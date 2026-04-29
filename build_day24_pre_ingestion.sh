#!/bin/bash

echo "[🚀] Initiating Day 24: Zero-Code Pre-Ingestion Engine..."

# 1. Update Prisma Schema to track all successful payments pre-dispute
cat << 'SCHEMA' >> prisma/schema.prisma

model PreRecordedEvidence {
  id              String   @id @default(uuid())
  stripeChargeId  String   @unique
  organizationId  String
  customerName    String?
  customerEmail   String?
  billingAddress  String?
  ipAddress       String?
  geoData         String?
  createdAt       DateTime @default(now())
}
SCHEMA

npx prisma db push

# 2. Upgrade the Stripe Webhook to listen to EVERY transaction
cat << 'CODE' > src/webhooks/stripeWebhook.ts
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

export const handleStripeWebhook = async (req: Request, res: Response, orgId: string): Promise<void> => {
    try {
        const org = await prisma.organization.findUnique({ where: { id: orgId } });
        if (!org || !org.encryptedStripeKey) { res.status(400).send("Org not found or missing keys."); return; }

        // Note: In a production environment, you decrypt the actual Stripe key here.
        // For our MVP, we assume the webhook structure is valid.
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
            
            // Sometimes merchants pass IP in metadata
            let ipAddress = charge.metadata?.ip_address || null;
            let geoData = address; // Default geo to billing address

            // If we found an IP, run your IPAPI key from .env
            if (ipAddress && process.env.IPAPI_API) {
                try {
                    const geoRes = await axios.get(`https://ipapi.co/${ipAddress}/json/?key=${process.env.IPAPI_API}`);
                    if (geoRes.data && !geoRes.data.error) {
                        geoData = `${geoRes.data.city}, ${geoRes.data.region}, ${geoRes.data.country_name} (IP Tracked)`;
                    }
                } catch (e) { console.error("IPAPI Lookup Failed."); }
            }

            // Lock it in the Vault BEFORE a dispute happens
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
            const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;

            console.log(`[🚨] DISPUTE DETECTED: ${dispute.id} for Org ${orgId}`);

            // The Worker will now pull from 'PreRecordedEvidence' when generating the PDF
            // because the data is already waiting in the database!
        }

        res.json({ received: true });
    } catch (err) {
        console.error("Stripe Webhook Error:", err);
        res.status(400).send(`Webhook Error`);
    }
};
CODE

echo "[✅] Pre-Ingestion Engine Online. Backend Restarting..."
npm run dev
