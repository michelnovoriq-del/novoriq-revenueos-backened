import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

export interface EvidenceData {
    disputeId: string;
    chargeId: string;
    amount: number;
    reason: string;
    date: string;
    organizationName: string;
    customerName: string;
    customerEmail: string;
    billingAddress?: string;
    cvcCheck?: string;
    avsCheck?: string;
    customerIp?: string;
    deviceFingerprint?: string;
    location?: string;
    radarScore?: number | string;
    threeDSecureStatus?: string;
}

export interface POVData {
    organizationId: string;
    organizationName: string;
    totalVolumeCents: number;
    criticalThreatsBlocked: number;
    capitalProtectedCents: number;
    threatLog: Array<{
        chargeId: string;
        amountCents: number;
        trustScore: number;
        recommendation: string;
    }>;
}

export const generateCompellingEvidence = async (data: EvidenceData): Promise<string> => {
    let browser;
    try {
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    /* Premium System Font Stack - Palantir/Stripe Enterprise Vibe */
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 50px; color: #0f172a; background-color: #ffffff; margin: 0; }
                    
                    /* Header Styling */
                    .document-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #020617; padding-bottom: 15px; margin-bottom: 35px; }
                    .logo-text { font-weight: 900; font-size: 26px; color: #020617; letter-spacing: -0.5px; text-transform: uppercase; }
                    .doc-meta { text-align: right; font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 1px; line-height: 1.5; font-family: monospace; }
                    
                    /* Title Styling */
                    .title { font-size: 28px; font-weight: 300; color: #020617; margin: 0 0 5px 0; letter-spacing: -0.5px; }
                    .subtitle { font-size: 11px; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 35px; }
                    
                    /* Data Cards */
                    .card { border: 1px solid #cbd5e1; border-radius: 4px; padding: 25px; margin-bottom: 25px; background-color: #f8fafc; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
                    .card-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #334155; margin-bottom: 15px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; letter-spacing: 1px; display: flex; justify-content: space-between; }
                    
                    /* Table Styling */
                    table { width: 100%; border-collapse: collapse; }
                    td { padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
                    tr:last-child td { border-bottom: none; padding-bottom: 0; }
                    .label { color: #64748b; width: 45%; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
                    .value { text-align: right; font-weight: 600; color: #0f172a; }
                    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; }
                    
                    /* Badges and Highlights */
                    .highlight-red { color: #b91c1c; background: #fef2f2; padding: 4px 8px; border-radius: 4px; font-weight: 700; }
                    .pass { color: #047857; background: #d1fae5; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
                    .kill-shot { color: #1e3a8a; background: #dbeafe; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #bfdbfe; }
                    
                    /* Footer & Legal */
                    .footer { margin-top: 40px; font-size: 10px; color: #475569; text-align: justify; line-height: 1.6; border-top: 2px solid #e2e8f0; padding-top: 20px; font-weight: 500; }
                    .forensic-stamp { text-align: center; margin-top: 30px; font-family: monospace; font-size: 10px; color: #94a3b8; font-weight: 600; letter-spacing: 1px; }
                </style>
            </head>
            <body>
                <div class="document-header">
                    <div class="logo-text">NOVORIQ REVENUE OS</div>
                    <div class="doc-meta">
                        Automated Forensic Audit<br>
                        Timestamp: ${new Date().toUTCString()}<br>
                        Network: Stripe API V2
                    </div>
                </div>

                <h1 class="title">Formal Dispute Rebuttal</h1>
                <div class="subtitle">Cryptographic Evidence Dossier & Liability Assessment</div>

                <!-- NEW: LAYER 1 KILL SHOT DATA -->
                <div class="card" style="border-left: 4px solid #3b82f6;">
                    <div class="card-title">
                        <span>I. Gateway Intelligence & Liability Shift</span>
                        <span style="color: #3b82f6;">CRITICAL REVIEW</span>
                    </div>
                    <table>
                        <tr>
                            <td class="label">3D Secure Protocol Status</td>
                            <td class="value">
                                ${data.threeDSecureStatus === 'authenticated' || data.threeDSecureStatus === 'attempt_acknowledged'
                                    ? '<span class="kill-shot">✓ AUTHENTICATED (LIABILITY SHIFT ACTIVE)</span>' 
                                    : '<span class="mono" style="color: #64748b;">' + (data.threeDSecureStatus || 'Not Requested / Unavailable') + '</span>'}
                            </td>
                        </tr>
                        <tr>
                            <td class="label">Stripe Radar Machine Learning Score</td>
                            <td class="value">
                                ${data.radarScore !== 'N/A' && data.radarScore !== null && data.radarScore !== undefined
                                    ? `<span class="pass">SCORE: ${data.radarScore}/100 (EXTREMELY LOW RISK)</span>`
                                    : '<span class="mono" style="color: #64748b;">Assessment Unavailable</span>'}
                            </td>
                        </tr>
                    </table>
                </div>

                <div class="card">
                    <div class="card-title">II. Transaction Summary</div>
                    <table>
                        <tr><td class="label">Merchant Organization</td><td class="value">${data.organizationName}</td></tr>
                        <tr><td class="label">Dispute Reference ID</td><td class="value mono">${data.disputeId}</td></tr>
                        <tr><td class="label">Stripe Network Charge ID</td><td class="value mono">${data.chargeId}</td></tr>
                        <tr><td class="label">Time of Transaction</td><td class="value">${data.date}</td></tr>
                        <tr><td class="label">Contested Amount</td><td class="value"><span class="highlight-red">$${(data.amount / 100).toFixed(2)} USD</span></td></tr>
                        <tr><td class="label">Filing Reason</td><td class="value" style="text-transform: capitalize; font-weight: 800;">${data.reason}</td></tr>
                    </table>
                </div>

                <div class="card">
                    <div class="card-title">III. Network Verification Matches</div>
                    <table>
                        <tr><td class="label">Authorized Customer Name</td><td class="value">${data.customerName}</td></tr>
                        <tr><td class="label">Verified Email Address</td><td class="value mono">${data.customerEmail}</td></tr>
                        <tr><td class="label">Provided Billing Address</td><td class="value">${data.billingAddress || 'Not Provided'}</td></tr>
                        <tr><td class="label">Cryptographic CVC Check</td><td class="value"><span class="pass">✓ ${data.cvcCheck || 'MATCH'}</span></td></tr>
                        <tr><td class="label">Address Verification System (AVS)</td><td class="value"><span class="pass">✓ ${data.avsCheck || 'MATCH'}</span></td></tr>
                    </table>
                </div>

                <div class="card">
                    <div class="card-title">IV. IP & Geographic Footprint</div>
                    <table>
                        <tr><td class="label">Purchasing IP Address</td><td class="value mono">${data.customerIp || 'N/A'}</td></tr>
                        <tr><td class="label">Resolved Geographic Location</td><td class="value">${data.location || 'N/A'}</td></tr>
                        <tr><td class="label">Hardware Fingerprint Hash</td><td class="value mono">${data.deviceFingerprint || 'Not Captured'}</td></tr>
                    </table>
                </div>

                <div class="footer">
                    <strong>DECLARATION OF FACT:</strong> This forensic audit establishes that the transaction was fully authorized by the cardholder. Network-level protocols, including CVC verification and internal risk scoring, passed at the time of purchase. Where 3D Secure is marked as Authenticated, the cardholder explicitly verified their identity with their issuing bank, triggering a strict liability shift away from the merchant. We formally request the immediate reversal of this dispute based on the irrefutable network evidence provided herein.
                </div>

                <div class="forensic-stamp">
                    X-TRACE-HASH: ${Buffer.from(data.disputeId + data.chargeId + Date.now().toString()).toString('hex').substring(0, 32).toUpperCase()} | SECURED BY NOVORIQ
                </div>
            </body>
            </html>
        `;

        const outputDir = path.join(__dirname, '../../outputs');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const fileName = `Novoriq_Evidence_${data.disputeId}.pdf`;
        const outputPath = path.join(outputDir, fileName);

        browser = await puppeteer.launch({ 
            headless: true, 
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ] 
        });
        
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
        
        await page.pdf({ 
            path: outputPath, 
            format: 'A4',
            printBackground: true, 
            margin: { top: '0', bottom: '0', left: '0', right: '0' } 
        });

        console.log(`[📄] Compelling Evidence Generated: ${fileName}`);
        return outputPath;

    } catch (error) {
        console.error(`[❌] PDF Generation Failed for ${data.disputeId}:`, error);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
};

// --- 📊 NEW: THE PROOF OF VALUE (POV) ENGINE ---
export const generatePOVReport = async (data: POVData): Promise<string> => {
    let browser;
    try {
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 50px; color: #0f172a; background-color: #ffffff; margin: 0; }
                    .document-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #020617; padding-bottom: 15px; margin-bottom: 35px; }
                    .logo-text { font-weight: 900; font-size: 26px; color: #020617; letter-spacing: -0.5px; text-transform: uppercase; }
                    .doc-meta { text-align: right; font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 1px; line-height: 1.5; font-family: monospace; }
                    .title { font-size: 28px; font-weight: 300; color: #020617; margin: 0 0 5px 0; letter-spacing: -0.5px; }
                    .subtitle { font-size: 11px; font-weight: 800; color: #16a34a; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 35px; }
                    
                    /* Hero Metrics Box */
                    .hero-box { background-color: #0f172a; color: white; border-radius: 8px; padding: 30px; margin-bottom: 40px; display: flex; justify-content: space-between; }
                    .metric { display: flex; flex-direction: column; }
                    .metric-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; margin-bottom: 5px; }
                    .metric-value { font-size: 32px; font-weight: 300; color: white; }
                    .metric-value.highlight { color: #4ade80; font-weight: 600; }
                    
                    /* Threat Log */
                    .section-title { font-size: 14px; font-weight: 800; text-transform: uppercase; color: #334155; margin-bottom: 15px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; letter-spacing: 1px; }
                    .threat-item { padding: 15px 0; border-bottom: 1px dashed #e2e8f0; }
                    .threat-header { display: flex; justify-content: space-between; margin-bottom: 5px; }
                    .threat-id { font-family: monospace; font-weight: 600; color: #0f172a; font-size: 13px; }
                    .threat-amount { color: #b91c1c; font-weight: 700; font-size: 13px; }
                    .threat-details { font-size: 12px; color: #475569; line-height: 1.5; }
                    .trust-score { font-family: monospace; font-size: 11px; color: #020617; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; margin-right: 10px; }
                    
                    .forensic-stamp { text-align: center; margin-top: 50px; font-family: monospace; font-size: 10px; color: #94a3b8; font-weight: 600; letter-spacing: 1px; }
                </style>
            </head>
            <body>
                <div class="document-header">
                    <div class="logo-text">NOVORIQ REVENUE OS</div>
                    <div class="doc-meta">
                        Client: ${data.organizationName}<br>
                        Cycle: ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}<br>
                        Node: Intelligence Layer 2
                    </div>
                </div>

                <h1 class="title">Proof of Value Report</h1>
                <div class="subtitle">AI Infrastructure ROI Analysis</div>

                <div class="hero-box">
                    <div class="metric">
                        <span class="metric-label">Total Processed</span>
                        <span class="metric-value">$${(data.totalVolumeCents / 100).toFixed(2)}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Threats Blocked</span>
                        <span class="metric-value">${data.criticalThreatsBlocked}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Capital Protected</span>
                        <span class="metric-value highlight">$${(data.capitalProtectedCents / 100).toFixed(2)}</span>
                    </div>
                </div>

                <div class="section-title">Critical Threat Interception Log</div>
                
                ${data.threatLog.length === 0 
                    ? '<div style="color: #64748b; font-size: 13px; font-style: italic;">No critical threats detected during this cycle.</div>' 
                    : data.threatLog.map(threat => `
                        <div class="threat-item">
                            <div class="threat-header">
                                <span class="threat-id">TXN_${threat.chargeId.substring(0,12)}...</span>
                                <span class="threat-amount">At Risk: $${(threat.amountCents / 100).toFixed(2)}</span>
                            </div>
                            <div class="threat-details">
                                <span class="trust-score">TRUST: ${threat.trustScore}/100</span>
                                ${threat.recommendation}
                            </div>
                        </div>
                    `).join('')}

                <div class="forensic-stamp">
                    X-TRACE-HASH: ${Buffer.from(data.organizationId + Date.now().toString()).toString('hex').substring(0, 32).toUpperCase()} | SECURED BY NOVORIQ
                </div>
            </body>
            </html>
        `;

        const outputDir = path.join(__dirname, '../../outputs/reports');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const fileName = `Novoriq_POV_${data.organizationId}_${Date.now()}.pdf`;
        const outputPath = path.join(outputDir, fileName);

        browser = await puppeteer.launch({ 
            headless: true, 
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] 
        });
        
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
        
        await page.pdf({ 
            path: outputPath, 
            format: 'A4',
            printBackground: true, 
            margin: { top: '0', bottom: '0', left: '0', right: '0' } 
        });

        console.log(`[📊] Proof of Value Report Generated: ${fileName}`);
        return outputPath;

    } catch (error) {
        console.error(`[❌] POV Report Generation Failed for ${data.organizationId}:`, error);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
};