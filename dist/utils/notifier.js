"use strict";
// lib/notifier.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCriticalFraudAlert = sendCriticalFraudAlert;
async function sendCriticalFraudAlert(clientWebhookUrl, customerEmail, trustScore, recommendation) {
    if (!clientWebhookUrl)
        return;
    // This format works perfectly for both Slack and Discord webhooks
    const payload = {
        content: `🚨 **CRITICAL FRAUD WARNING: Novoriq Intelligence Node** 🚨\n\n**Target Account:** \`${customerEmail}\`\n**Trust Score:** \`${trustScore}/100\`\n\n**AI Recommendation:**\n> ${recommendation}\n\n*Please review this transaction immediately in your Novoriq Dashboard.*`
    };
    try {
        await fetch(clientWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        console.log(`[📣] Critical alert broadcasted successfully for ${customerEmail}`);
    }
    catch (error) {
        console.error(`[❌] Failed to broadcast alert:`, error);
    }
}
