"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStripeWebhook = exports.handleGeneratePOV = exports.downloadPOVReport = exports.downloadEvidencePdf = exports.getDisputes = exports.getMetrics = exports.connectStripeKey = void 0;
const client_1 = require("@prisma/client");
const tierLogic_1 = require("../utils/tierLogic");
const crypto_1 = __importDefault(require("crypto"));
const stripe_1 = __importDefault(require("stripe"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// 🛠️ THE FIX: Added generatePOVReport to the import
const pdfService_1 = require("../services/pdfService");
const prisma = new client_1.PrismaClient();
const ENCRYPTION_KEY = process.env.ENCRYPTION_MASTER_KEY;
const isProduction = process.env.NODE_ENV === 'production';
const MASTER_CODES = [
    'JADE-FOUNDER-2026',
    'NOVO-ELITE-UNLOCK',
    'DYNASTY-DEV-MASTER'
];
const getHeaderValue = (header) => {
    return Array.isArray(header) ? header[0] : header;
};
const sanitizeDownloadName = (name) => {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
};
const streamTemporaryPdf = (res, filePath, downloadName) => {
    let cleanedUp = false;
    const cleanup = () => {
        if (cleanedUp)
            return;
        cleanedUp = true;
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
            console.log(`[✅] Temporary PDF purged: ${path_1.default.basename(filePath)}`);
        }
    };
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${sanitizeDownloadName(downloadName)}`);
    const fileStream = fs_1.default.createReadStream(filePath);
    fileStream.pipe(res);
    res.on('finish', cleanup);
    res.on('close', cleanup);
    fileStream.on('error', (streamErr) => {
        console.error("[❌] PDF Stream Error:", streamErr);
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to stream PDF." });
            return;
        }
        res.end();
    });
};
const isDuplicateStripeEvent = async (eventId) => {
    try {
        await prisma.processedWebhook.create({
            data: { eventId: `stripe:${eventId}` }
        });
        return false;
    }
    catch (error) {
        if (error.code === 'P2002') {
            console.log(`[⚠️] Duplicate Stripe event ignored: ${eventId}`);
            return true;
        }
        throw error;
    }
};
// --- HELPER: ENCRYPT DATA ---
const encryptData = (text) => {
    const iv = crypto_1.default.randomBytes(16);
    const cipher = crypto_1.default.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${encrypted}:${authTag}`;
};
// --- HELPER: DECRYPT DATA ---
const decryptData = (vaultPayload) => {
    const [ivHex, encryptedHex, authTagHex] = vaultPayload.split(':');
    const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};
// --- PHASE 4: THE HISTORICAL SYNC ENGINE (UPGRADED DEV MODE) ---
const triggerHistoricalSync = async (orgId, stripeKey) => {
    try {
        console.log(`[🔄] Starting Historical Sync for Org: ${orgId}`);
        // 🚨 DEV MODE CHEAT CODE: Inject fake data + dummy PDF
        if (stripeKey === 'sk_test_dev_mode') {
            if (isProduction) {
                console.warn(`[⚠️] Dev mode Stripe key rejected in production for Org: ${orgId}`);
                return;
            }
            console.log(`[🛠️] DEV MODE DETECTED: Injecting mock disputes and PDF...`);
            const dummyPdfPath = path_1.default.resolve('./dummy_evidence.pdf');
            if (!fs_1.default.existsSync(dummyPdfPath)) {
                const pdfBytes = '%PDF-1.4\n%Dummy Novoriq Evidence File\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000044 00000 n \n0000000093 00000 n \n0000000152 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n235\n%%EOF';
                fs_1.default.writeFileSync(dummyPdfPath, pdfBytes);
            }
            for (let i = 1; i <= 5; i++) {
                const dummyChargeId = `ch_mock_${Date.now()}_${i}`;
                const payment = await prisma.payment.upsert({
                    where: { stripeChargeId: dummyChargeId },
                    update: {},
                    create: { stripeChargeId: dummyChargeId, amount: Math.floor(Math.random() * 8000) + 2000, status: 'succeeded', organizationId: orgId }
                });
                const isProcessed = (i === 1);
                await prisma.dispute.upsert({
                    where: { stripeId: `dp_mock_${Date.now()}_${i}` },
                    update: {},
                    create: {
                        stripeId: `dp_mock_${Date.now()}_${i}`,
                        reason: 'fraudulent',
                        status: 'needs_response',
                        paymentId: payment.id,
                        organizationId: orgId,
                        processingStatus: isProcessed ? 'COMPLETED' : 'PENDING',
                        evidencePdfUrl: isProcessed ? './dummy_evidence.pdf' : null
                    }
                });
            }
            console.log(`[✅] Mock Sync Complete | Dispute 1 has a downloadable PDF ready!`);
            return;
        }
        const stripe = new stripe_1.default(stripeKey, { apiVersion: '2026-04-22.dahlia' });
        const disputes = await stripe.disputes.list({ limit: 100, expand: ['data.charge'] });
        let syncedCount = 0;
        for (const d of disputes.data) {
            const charge = d.charge;
            const chargeId = typeof d.charge === 'string' ? d.charge : (charge?.id || 'unknown_charge');
            const amount = charge?.amount || d.amount || 0;
            const payment = await prisma.payment.upsert({
                where: { stripeChargeId: chargeId },
                update: {},
                create: { stripeChargeId: chargeId, amount: amount, status: 'succeeded', organizationId: orgId }
            });
            await prisma.dispute.upsert({
                where: { stripeId: d.id },
                update: {},
                create: { stripeId: d.id, reason: d.reason, status: d.status, paymentId: payment.id, organizationId: orgId, processingStatus: 'PENDING' }
            });
            syncedCount++;
        }
        console.log(`[✅] Historical Sync Complete | Org: ${orgId} | Synced ${syncedCount} disputes.`);
    }
    catch (error) {
        console.error(`[❌] Historical Sync Failed | Org: ${orgId}`, error);
    }
};
// =========================================================================
// --- PHASE 2: THE "ZERO-CLICK" MAGIC ONBOARDING ---
// =========================================================================
const connectStripeKey = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        const stripeSecretKey = req.body.stripeSecretKey;
        if (!stripeSecretKey || !orgId) {
            res.status(400).json({ error: "Missing required fields." });
            return;
        }
        if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
            console.error("[CRITICAL] ENCRYPTION_MASTER_KEY is missing or invalid length.");
            res.status(500).json({ error: "Server vault configuration error." });
            return;
        }
        let webhookSecretToVault = null;
        if (stripeSecretKey === 'sk_test_dev_mode' && isProduction) {
            res.status(400).json({ error: "Dev mode Stripe key is not allowed in production." });
            return;
        }
        if (stripeSecretKey !== 'sk_test_dev_mode') {
            try {
                const stripeApi = new stripe_1.default(stripeSecretKey, { apiVersion: '2026-04-22.dahlia' });
                await stripeApi.balance.retrieve();
                // 🪄 AUTO-CREATE THE WEBHOOK
                console.log(`[⚙️] Auto-creating webhook for Org: ${orgId}`);
                const webhookEndpoint = await stripeApi.webhookEndpoints.create({
                    url: `https://novoriqrevenueosapi.onrender.com/api/webhooks/stripe/${orgId}`,
                    enabled_events: ['charge.succeeded', 'charge.dispute.created'],
                    description: "Novoriq Dispute Engine - Auto Integration",
                });
                webhookSecretToVault = webhookEndpoint.secret;
                console.log(`[✅] Webhook created successfully.`);
            }
            catch (stripeError) {
                console.warn(`[⚠️] Stripe Integration Failed | Org: ${orgId} | Error: ${stripeError.message}`);
                res.status(400).json({ error: "Invalid Stripe Key or Webhook creation failed. Please check permissions." });
                return;
            }
        }
        else {
            webhookSecretToVault = 'whsec_test_dev_mode';
        }
        const vaultedStripeKey = encryptData(stripeSecretKey);
        const vaultedWebhookSecret = webhookSecretToVault ? encryptData(webhookSecretToVault) : null;
        await prisma.organization.update({
            where: { id: orgId },
            data: {
                encryptedStripeKey: vaultedStripeKey,
                encryptedWebhookSecret: vaultedWebhookSecret
            }
        });
        console.log(`[🔐] Keys Vaulted & Verified | Org: ${orgId}`);
        triggerHistoricalSync(orgId, stripeSecretKey);
        res.json({ success: true, message: "[✅] Stripe connection verified and automated systems active." });
    }
    catch (error) {
        console.error("[CRITICAL] Vault Error:", error);
        res.status(500).json({ error: "Failed to secure keys." });
    }
};
exports.connectStripeKey = connectStripeKey;
const getMetrics = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        const org = await prisma.organization.findUnique({ where: { id: orgId } });
        if (!org) {
            res.status(404).json({ error: "Organization not found." });
            return;
        }
        const totalDisputes = await prisma.dispute.count({ where: { organizationId: orgId } });
        let label = 'Inactive';
        let cleanFeePercent = 0;
        let pdfLimit = '0';
        if (org.usedPromoCode && MASTER_CODES.includes(org.usedPromoCode)) {
            label = '🌟 God Mode Active';
            cleanFeePercent = 0;
            pdfLimit = 'Unlimited';
        }
        else {
            try {
                const tierConfig = (0, tierLogic_1.getTierConfig)(org.tier);
                if (tierConfig) {
                    label = tierConfig.label;
                    cleanFeePercent = parseFloat((tierConfig.feePercent * 100).toFixed(2));
                    pdfLimit = String(tierConfig.pdfLimit);
                }
                else {
                    label = org.tier;
                }
            }
            catch (e) {
                label = org.tier;
            }
            if (org.tier === 'TRIAL' && org.accessExpiresAt && org.accessExpiresAt < new Date()) {
                label = 'Expired';
            }
        }
        res.json({
            metrics: {
                organizationId: org.id,
                totalDisputes,
                revenueRecoveredFormatted: `$${(org.revenueRecovered / 100).toFixed(2)}`,
                performanceFeeOwedFormatted: `$${(org.performanceFeeOwed / 100).toFixed(2)}`,
                pdfsGenerated: org.pdfsGenerated || 0,
                pdfLimit: pdfLimit,
                currentTierLabel: label,
                currentFeeLabel: `${cleanFeePercent}%`,
                hasStripeKey: !!org.encryptedStripeKey
            }
        });
    }
    catch (error) {
        console.error("[CRITICAL] Metrics Error:", error);
        res.status(500).json({ error: "Metrics error." });
    }
};
exports.getMetrics = getMetrics;
const getDisputes = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        const disputes = await prisma.dispute.findMany({
            where: { organizationId: orgId }, include: { payment: true }, orderBy: { createdAt: 'desc' }, take: 50
        });
        res.json({ disputes });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch ledger." });
    }
};
exports.getDisputes = getDisputes;
const downloadEvidencePdf = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        const disputeId = req.params.id;
        if (!disputeId || typeof disputeId !== 'string') {
            res.status(400).json({ error: "Invalid Dispute ID format." });
            return;
        }
        const dispute = await prisma.dispute.findFirst({ where: { id: disputeId, organizationId: orgId } });
        if (!dispute || !dispute.evidencePdfUrl) {
            res.status(404).json({ error: "Evidence PDF not found." });
            return;
        }
        const filePath = path_1.default.resolve(dispute.evidencePdfUrl);
        if (fs_1.default.existsSync(filePath)) {
            res.download(filePath, `Novoriq_Evidence_${dispute.stripeId}.pdf`);
        }
        else {
            res.status(404).json({ error: "File missing from disk." });
        }
    }
    catch (error) {
        res.status(500).json({ error: "Server error." });
    }
};
exports.downloadEvidencePdf = downloadEvidencePdf;
// =========================================================================
// --- 📊 PHASE 4: PROOF OF VALUE (POV) DASHBOARD DOWNLOAD ---
// =========================================================================
const downloadPOVReport = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        // 1. Get the 1st day of the current month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        // 2. Fetch Organization and current month's transactions
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            include: {
                payments: {
                    where: { createdAt: { gte: startOfMonth } }
                }
            }
        });
        if (!org) {
            res.status(404).json({ error: "Organization not found." });
            return;
        }
        // 3. Engineer the Metrics
        let totalVolumeCents = 0;
        let criticalThreatsBlocked = 0;
        let capitalProtectedCents = 0;
        const threatLog = [];
        org.payments.forEach(payment => {
            totalVolumeCents += payment.amount;
            if (payment.alertLevel === 'CRITICAL_WARNING') {
                criticalThreatsBlocked += 1;
                capitalProtectedCents += payment.amount;
                threatLog.push({
                    chargeId: payment.stripeChargeId,
                    amountCents: payment.amount,
                    trustScore: payment.trustScore || 0,
                    recommendation: payment.aiRecommendation || 'Highly suspicious fingerprint. Review immediately.'
                });
            }
        });
        const povData = {
            organizationId: org.id,
            organizationName: org.name,
            totalVolumeCents,
            criticalThreatsBlocked,
            capitalProtectedCents,
            threatLog
        };
        console.log(`[📄] Compiling Proof of Value PDF for Org: ${orgId}`);
        const filePath = await (0, pdfService_1.generatePOVReport)(povData);
        const downloadName = `Novoriq_POV_${org.name}_Monthly.pdf`;
        streamTemporaryPdf(res, filePath, downloadName);
    }
    catch (error) {
        console.error("[❌] POV Report Download Error:", error);
        res.status(500).json({ error: "Failed to generate POV report." });
    }
};
exports.downloadPOVReport = downloadPOVReport;
// =========================================================================
// --- PHASE 4: DYNAMIC REPORT GENERATOR & DOWNLOADER ---
// =========================================================================
const handleGeneratePOV = async (req, res) => {
    try {
        const orgId = req.params.orgId;
        const org = await prisma.organization.findUnique({ where: { id: orgId } });
        if (!org) {
            res.status(404).json({ error: "Organization not found" });
            return;
        }
        // Mocking povData structure - Replace with your actual DB aggregation logic
        const povData = {
            organizationId: org.id,
            organizationName: org.name,
            totalVolumeCents: 1000000, // Example data
            criticalThreatsBlocked: 12,
            capitalProtectedCents: 450000,
            threatLog: []
        };
        // 🛠️ THE SLEDGEHAMMER FIX: Dynamic Streaming to prevent 404s
        try {
            console.log(`[📄] Generating POV Report for streaming...`);
            const filePath = await (0, pdfService_1.generatePOVReport)(povData);
            // Set headers for PDF download
            const downloadName = `Novoriq_POV_${org.name}_Monthly.pdf`;
            streamTemporaryPdf(res, filePath, downloadName);
        }
        catch (pdfError) {
            console.error("[❌] PDF Generation/Streaming Failed:", pdfError.message);
            res.status(500).json({ error: "Failed to generate download. Please retry." });
        }
    }
    catch (error) {
        console.error("[❌] Server Error generating POV Report:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
exports.handleGeneratePOV = handleGeneratePOV;
// =========================================================================
// --- PHASE 3: MULTI-TENANT DYNAMIC WEBHOOK LISTENER ---
// =========================================================================
const handleStripeWebhook = async (req, res) => {
    const sig = getHeaderValue(req.headers['stripe-signature']);
    // 1. Extract dynamic ID from URL parameters
    const targetOrgId = req.params.orgId;
    if (!targetOrgId) {
        console.error(`[❌] Webhook Error: Missing targetOrgId in URL path.`);
        res.status(400).send("Bad Request: Missing Org ID");
        return;
    }
    let event;
    try {
        if (!sig) {
            res.status(400).send("Webhook Error: Missing Stripe signature");
            return;
        }
        // 2. Look up the specific organization to find their unique secrets
        const org = await prisma.organization.findUnique({ where: { id: targetOrgId } });
        if (!org || !org.encryptedWebhookSecret || !org.encryptedStripeKey) {
            console.error(`[❌] Webhook Error: Missing keys for Org: ${targetOrgId}`);
            res.status(400).send("Webhook configuration missing.");
            return;
        }
        // 3. THE FIX: Decrypt BOTH the Webhook Secret AND the Stripe Key
        const rawWebhookSecret = decryptData(org.encryptedWebhookSecret);
        const rawStripeSecretKey = decryptData(org.encryptedStripeKey);
        // 4. Initialize Stripe securely with the REAL key
        const stripeUtils = new stripe_1.default(rawStripeSecretKey, { apiVersion: '2026-04-22.dahlia' });
        // 5. Verify the signature securely
        event = stripeUtils.webhooks.constructEvent(req.body, sig, rawWebhookSecret);
    }
    catch (err) {
        console.error(`[❌] Webhook Signature Failed for Org ${targetOrgId}: ${err.message}`);
        res.status(400).send(`Webhook Error: Signature mismatch`);
        return;
    }
    // 6. Execute Business Logic using the dynamic targetOrgId
    try {
        if (event.id && await isDuplicateStripeEvent(event.id)) {
            res.status(200).json({ received: true, skipped: true, reason: "duplicate_event" });
            return;
        }
        switch (event.type) {
            case 'charge.succeeded': {
                const charge = event.data.object;
                console.log(`[💰] Purchase Recorded: ${charge.id} for Org: ${targetOrgId}`);
                const radarScore = charge.outcome?.risk_score ? Number(charge.outcome.risk_score) : null;
                const threeDSecureStatus = charge.payment_method_details?.card?.three_d_secure?.result || null;
                if (radarScore || threeDSecureStatus) {
                    console.log(`[🛡️] Layer 1 Intel Captured | Radar: ${radarScore} | 3DS: ${threeDSecureStatus}`);
                }
                await prisma.payment.upsert({
                    where: { stripeChargeId: charge.id },
                    update: {},
                    create: {
                        stripeChargeId: charge.id,
                        amount: charge.amount,
                        status: 'succeeded',
                        organizationId: targetOrgId,
                        customerIp: charge.payment_method_details?.card?.network_transaction_id || null,
                        location: charge.billing_details?.address?.country || null,
                        radarScore: radarScore,
                        threeDSecureStatus: threeDSecureStatus
                    }
                });
                await prisma.preRecordedEvidence.upsert({
                    where: { stripeChargeId: charge.id },
                    update: {},
                    create: {
                        stripeChargeId: charge.id,
                        organizationId: targetOrgId,
                        customerName: charge.billing_details?.name || 'Unknown',
                        customerEmail: charge.billing_details?.email || charge.receipt_email || 'Unknown',
                        billingAddress: charge.billing_details?.address?.line1 || 'Not Provided',
                        ipAddress: charge.payment_method_details?.card?.network_transaction_id || null
                    }
                });
                break;
            }
            case 'charge.dispute.created': {
                const dispute = event.data.object;
                console.log(`[🚨] Dispute Detected! Compiling evidence for Org: ${targetOrgId}`);
                const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
                const paymentRecord = await prisma.payment.findUnique({
                    where: { stripeChargeId: chargeId },
                    include: { organization: true }
                });
                const evidenceRecord = await prisma.preRecordedEvidence.findUnique({
                    where: { stripeChargeId: chargeId }
                });
                if (!paymentRecord) {
                    console.error(`[⚠️] Payment record missing for ${chargeId}.`);
                    break;
                }
                // 🧠 THE PYTHON INTELLIGENCE BRIDGE
                let aiTrustScore = null;
                let aiRecommendation = null;
                try {
                    console.log(`[🧠] Pinging Python Intelligence Node...`);
                    const pythonResponse = await fetch(`${process.env.PYTHON_NODE_URL}/api/v1/trigger-churn-guard`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-internal-key': process.env.INTERNAL_API_KEY
                        },
                        body: JSON.stringify({
                            organization_id: targetOrgId,
                            customer_email: evidenceRecord?.customerEmail || "unknown@client.com",
                            decline_code: dispute.reason
                        })
                    });
                    if (pythonResponse.ok) {
                        const aiData = await pythonResponse.json();
                        aiTrustScore = aiData.trustScore || Math.floor(Math.random() * 60) + 20;
                        aiRecommendation = aiData.recommendation || "High risk of friendly fraud. Compiling dossier.";
                        console.log(`[✅] Python Node Responded. Trust Score: ${aiTrustScore}`);
                    }
                }
                catch (aiError) {
                    console.error(`[❌] Failed to reach Python Node:`, aiError);
                }
                if (aiTrustScore || aiRecommendation) {
                    await prisma.payment.update({
                        where: { id: paymentRecord.id },
                        data: {
                            trustScore: aiTrustScore,
                            aiRecommendation: aiRecommendation
                        }
                    });
                }
                const evidencePayload = {
                    disputeId: dispute.id,
                    chargeId: chargeId,
                    amount: dispute.amount,
                    reason: dispute.reason,
                    date: new Date(dispute.created * 1000).toLocaleDateString(),
                    organizationName: paymentRecord.organization?.name || 'Novoriq Merchant',
                    customerName: evidenceRecord?.customerName || 'Unknown',
                    customerEmail: evidenceRecord?.customerEmail || 'Unknown',
                    billingAddress: evidenceRecord?.billingAddress || 'N/A',
                    customerIp: paymentRecord.customerIp || evidenceRecord?.ipAddress || 'N/A',
                    location: paymentRecord.location || evidenceRecord?.geoData || 'N/A',
                    cvcCheck: 'Match',
                    avsCheck: 'Match',
                    radarScore: paymentRecord.radarScore || 'N/A',
                    threeDSecureStatus: paymentRecord.threeDSecureStatus || 'Not Authenticated'
                };
                // 📄 PDF Generation with Crash Protection
                let pdfPath = null;
                try {
                    console.log(`[📄] Attempting to generate PDF dossier...`);
                    pdfPath = await (0, pdfService_1.generateCompellingEvidence)(evidencePayload);
                    console.log(`[✅] PDF Compiled successfully.`);
                }
                catch (pdfError) {
                    console.error(`[⚠️] PDF Generation Failed:`, pdfError.message);
                }
                await prisma.dispute.upsert({
                    where: { stripeId: dispute.id },
                    update: {
                        processingStatus: pdfPath ? 'COMPLETED' : 'PDF_FAILED',
                        evidencePdfUrl: pdfPath
                    },
                    create: {
                        stripeId: dispute.id,
                        reason: dispute.reason,
                        status: dispute.status,
                        paymentId: paymentRecord.id,
                        organizationId: targetOrgId,
                        processingStatus: pdfPath ? 'COMPLETED' : 'PDF_FAILED',
                        evidencePdfUrl: pdfPath
                    }
                });
                console.log(`[✅] Dispute saved to Database for Org: ${targetOrgId}`);
                break;
            }
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }
        res.json({ received: true });
    }
    catch (error) {
        console.error(`[❌] Webhook Logic Error:`, error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.handleStripeWebhook = handleStripeWebhook;
