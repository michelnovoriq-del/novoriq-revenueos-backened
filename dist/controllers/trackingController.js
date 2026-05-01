"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestTrackingData = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const ingestTrackingData = async (req, res) => {
    try {
        const { stripeSessionId, deviceFingerprint } = req.body;
        if (!stripeSessionId || !deviceFingerprint) {
            res.status(400).json({ error: "Missing required tracking parameters." });
            return;
        }
        // 1. Extract IP Address securely
        let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
        if (Array.isArray(ip))
            ip = ip[0];
        // Mock IP for local testing (localhost returns ::1, which breaks geo-lookups)
        if (ip === '::1' || ip === '127.0.0.1')
            ip = '8.8.8.8';
        // 2. Fetch Geolocation from ipapi.co
        let geolocation = 'Unknown / Encrypted';
        try {
            console.log(`[🌍] Pinging ipapi.co for IP: ${ip}...`);
            const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
            const geoData = await geoRes.json();
            if (geoData && !geoData.error) {
                geolocation = `${geoData.city}, ${geoData.region}, ${geoData.country_name} (Zip: ${geoData.postal})`;
            }
        }
        catch (error) {
            console.error("[⚠️] Geolocation lookup failed, saving raw IP.");
        }
        // 3. Lock the Golden Trio into the Database
        const intel = await prisma.trackingIntel.upsert({
            where: { stripeSessionId },
            update: { ipAddress: ip, geolocation, deviceFingerprint },
            create: { stripeSessionId, ipAddress: ip, geolocation, deviceFingerprint }
        });
        console.log(`[🎯] Golden Trio Secured | Session: ${stripeSessionId.substring(0, 10)}... | Geo: ${geolocation}`);
        res.status(200).json({ success: true, message: "Intel secured." });
    }
    catch (error) {
        console.error("[CRITICAL] Tracking ingestion failed:", error);
        res.status(500).json({ error: "System fault." });
    }
};
exports.ingestTrackingData = ingestTrackingData;
