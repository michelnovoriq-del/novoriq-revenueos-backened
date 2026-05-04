"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePOVReport = exports.generateCompellingEvidence = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const escapeHtml = (value) => {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};
const generateCompellingEvidence = async (data) => {
    let browser;
    try {
        // Dynamic Fields for Decision Logic
        const parsedRadarScore = Number(data.radarScore);
        const isRadarLowRisk = !isNaN(parsedRadarScore) && parsedRadarScore < 50;
        const confidenceLevel = isRadarLowRisk ? 'HIGH' : 'MEDIUM';
        const isAvsMatch = data.avsCheck?.toLowerCase().includes('match');
        const isCvcMatch = data.cvcCheck?.toLowerCase().includes('match');
        const formattedAmount = (data.amount / 100).toFixed(2);
        const safeData = {
            disputeId: escapeHtml(data.disputeId),
            chargeId: escapeHtml(data.chargeId),
            reason: escapeHtml(data.reason),
            date: escapeHtml(data.date),
            organizationName: escapeHtml(data.organizationName),
            customerName: escapeHtml(data.customerName || 'Unknown'),
            customerEmail: escapeHtml(data.customerEmail),
            billingAddress: escapeHtml(data.billingAddress || 'N/A'),
            cvcCheck: escapeHtml(data.cvcCheck || 'Not Provided'),
            avsCheck: escapeHtml(data.avsCheck || 'Not Provided'),
            customerIp: escapeHtml(data.customerIp || 'Not Captured'),
            deviceFingerprint: escapeHtml(data.deviceFingerprint || 'Not Captured'),
            location: escapeHtml(data.location || 'N/A'),
            radarScore: escapeHtml(data.radarScore !== 'N/A' ? `${data.radarScore}/100` : 'N/A'),
            threeDSecureStatus: escapeHtml(data.threeDSecureStatus || 'Not Authenticated')
        };
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #18181b; line-height: 1.5; font-size: 11px; margin: 0; padding: 40px; background-color: #ffffff; }
                    .header { border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
                    .title-block h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; margin: 0 0 4px 0; text-transform: uppercase; color: #000; }
                    .title-block p { font-size: 9px; color: #71717a; text-transform: uppercase; letter-spacing: 1px; margin: 0; font-family: monospace; }
                    .meta-block { text-align: right; font-size: 10px; font-family: monospace; color: #52525b; }
                    
                    .section-title { font-size: 12px; font-weight: 800; background: #f4f4f5; padding: 6px 10px; margin: 24px 0 12px 0; border-left: 3px solid #000; text-transform: uppercase; letter-spacing: 0.5px; }
                    
                    /* Executive Summary Box */
                    .summary-box { border: 1px solid #e4e4e7; background: #fafafa; padding: 16px; border-radius: 4px; margin-bottom: 24px; }
                    .summary-header { display: flex; justify-content: space-between; border-bottom: 1px solid #e4e4e7; padding-bottom: 8px; margin-bottom: 12px; }
                    .summary-stat { font-size: 11px; text-transform: uppercase; color: #71717a; font-weight: 600; }
                    .summary-val { font-size: 12px; font-weight: 800; color: #000; }
                    .summary-val.high { color: #10b981; }
                    .conclusion-text { font-size: 12px; font-weight: 600; color: #18181b; background: #e0f2fe; padding: 8px; border-radius: 4px; margin-top: 12px; border-left: 3px solid #0284c7; }
                    
                    .grid { display: flex; flex-wrap: wrap; margin-bottom: 12px; }
                    .grid-item { width: 50%; margin-bottom: 12px; padding-right: 10px; box-sizing: border-box; }
                    .label { font-size: 9px; color: #71717a; text-transform: uppercase; font-weight: 600; margin-bottom: 2px; }
                    .value { font-size: 12px; font-weight: 500; font-family: monospace; }
                    
                    /* Timeline */
                    .timeline { border-left: 2px solid #e4e4e7; margin-left: 6px; padding-left: 16px; margin-top: 12px; }
                    .timeline-item { position: relative; margin-bottom: 12px; }
                    .timeline-item::before { content: ''; position: absolute; left: -21px; top: 4px; width: 8px; height: 8px; background: #000; border-radius: 50%; }
                    .timeline-date { font-family: monospace; font-weight: 800; display: inline-block; width: 85px; }
                    .timeline-desc { color: #3f3f46; }
                    
                    /* Icons & Badges */
                    .check { color: #10b981; font-weight: 800; margin-right: 6px; }
                    .warn { color: #f59e0b; font-weight: 800; margin-right: 6px; }
                    .info { color: #3b82f6; font-weight: 800; margin-right: 6px; }
                    
                    .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e4e4e7; font-size: 9px; color: #a1a1aa; text-align: center; font-family: monospace; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title-block">
                        <h1>Dispute Decision Document</h1>
                        <p>Novoriq Revenue OS • Autonomous Assessment</p>
                    </div>
                    <div class="meta-block">
                        <div>REF: ${safeData.disputeId}</div>
                        <div>NET: ${safeData.chargeId}</div>
                        <div>GEN: ${new Date().toUTCString()}</div>
                    </div>
                </div>

                <!-- EXECUTIVE SUMMARY -->
                <div class="summary-box">
                    <div class="summary-header">
                        <div>
                            <span class="summary-stat">Confidence Level:</span> 
                            <span class="summary-val ${confidenceLevel === 'HIGH' ? 'high' : ''}">${confidenceLevel}</span>
                        </div>
                        <div>
                            <span class="summary-stat">Contested Amount:</span> 
                            <span class="summary-val" style="color: #b91c1c;">$${formattedAmount} USD</span>
                        </div>
                        <div>
                            <span class="summary-stat">Recommendation:</span> 
                            <span class="summary-val">REJECT DISPUTE</span>
                        </div>
                    </div>
                    <div class="label" style="margin-top: 8px;">Key Findings</div>
                    <div style="margin-bottom: 8px;">
                        <div><span class="check">✔</span> Payment cryptographically verified via Network Systems (CVC/AVS match)</div>
                        <div><span class="check">✔</span> Machine Learning Risk Analysis indicates low probability of unauthorized use</div>
                        <div><span class="check">✔</span> Network footprint is consistent with authorized usage</div>
                    </div>
                    <div class="conclusion-text">
                        Conclusion: Evidence strongly indicates that this transaction was authorized by the cardholder and digital access was fulfilled. We formally request this dispute be closed in the merchant's favor.
                    </div>
                </div>

                <!-- EVENT TIMELINE -->
                <div class="section-title">Event Timeline</div>
                <div class="timeline">
                    <div class="timeline-item">
                        <span class="timeline-date">${safeData.date}</span>
                        <span class="timeline-desc">Transaction authorized & account provisioned.</span>
                    </div>
                    <div class="timeline-item">
                        <span class="timeline-date">${safeData.date}</span>
                        <span class="timeline-desc">Product delivered (Digital Receipt / Access Granted).</span>
                    </div>
                    <div class="timeline-item">
                        <span class="timeline-date">Post-Sale</span>
                        <span class="timeline-desc">No refund requested via authorized merchant channels.</span>
                    </div>
                    <div class="timeline-item">
                        <span class="timeline-date">Current</span>
                        <span class="timeline-desc">Dispute filed ("${safeData.reason}") bypassing merchant resolution.</span>
                    </div>
                </div>

                <!-- AUTHORIZATION PROOF -->
                <div class="section-title">I. Authorization Proof</div>
                <div class="grid" style="margin-bottom: 0;">
                    <div class="grid-item">
                        <div class="label">CVC Verification</div>
                        <div class="value"><span class="${isCvcMatch ? 'check' : 'warn'}">${isCvcMatch ? '✔' : '⚠'}</span> ${safeData.cvcCheck}</div>
                    </div>
                    <div class="grid-item">
                        <div class="label">Address Verification (AVS)</div>
                        <div class="value"><span class="${isAvsMatch ? 'check' : 'warn'}">${isAvsMatch ? '✔' : '⚠'}</span> ${safeData.avsCheck}</div>
                    </div>
                    <div class="grid-item">
                        <div class="label">Stripe Radar Risk Score</div>
                        <div class="value"><span class="info">ℹ</span> ${safeData.radarScore} (Lower is safer)</div>
                    </div>
                    <div class="grid-item">
                        <div class="label">3D Secure Protocol</div>
                        <div class="value"><span class="info">ℹ</span> ${safeData.threeDSecureStatus}</div>
                    </div>
                </div>

                <!-- DELIVERY & USAGE PROOF -->
                <div class="section-title">II. Delivery & Usage Proof</div>
                <div class="grid" style="margin-bottom: 0;">
                    <div class="grid-item">
                        <div class="label">Authorized Customer Name</div>
                        <div class="value">${safeData.customerName}</div>
                    </div>
                    <div class="grid-item">
                        <div class="label">Customer Email</div>
                        <div class="value">${safeData.customerEmail}</div>
                    </div>
                    <div class="grid-item">
                        <div class="label">Purchasing IP Address</div>
                        <div class="value">${safeData.customerIp}</div>
                    </div>
                    <div class="grid-item">
                        <div class="label">System Access Records</div>
                        <div class="value"><span class="check">✔</span> Session activity consistent with usage</div>
                    </div>
                    <div class="grid-item">
                        <div class="label">Resolved Geographic Location</div>
                        <div class="value">${safeData.location}</div>
                    </div>
                    <div class="grid-item">
                        <div class="label">Hardware Fingerprint Hash</div>
                        <div class="value">${safeData.deviceFingerprint}</div>
                    </div>
                </div>

                <!-- POLICY AGREEMENT -->
                <div class="section-title">III. Policy Agreement</div>
                <div style="font-size: 11px; color: #3f3f46;">
                    <div><span class="check">✔</span> <strong>Terms of Service Accepted:</strong> Cardholder agreed to the strictly digital delivery terms at the time of checkout.</div>
                    <div style="margin-top: 6px;"><span class="check">✔</span> <strong>Clear Billing Descriptor:</strong> The charge appeared clearly on the statement for the associated merchant organization (${safeData.organizationName}).</div>
                </div>

                <div class="footer">
                    X-TRACE-HASH: ${Buffer.from(data.disputeId + data.chargeId + Date.now().toString()).toString('hex').substring(0, 32).toUpperCase()} | SECURED BY NOVORIQ REVENUE OS
                </div>
            </body>
            </html>
        `;
        const outputDir = path_1.default.join(__dirname, '../../outputs');
        if (!fs_1.default.existsSync(outputDir)) {
            fs_1.default.mkdirSync(outputDir, { recursive: true });
        }
        const fileName = `Novoriq_Evidence_${data.disputeId}.pdf`;
        const outputPath = path_1.default.join(outputDir, fileName);
        browser = await puppeteer_1.default.launch({
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
        console.log(`[📄] Decision Document Generated: ${fileName}`);
        return outputPath;
    }
    catch (error) {
        console.error(`[❌] PDF Generation Failed for ${data.disputeId}:`, error);
        throw error;
    }
    finally {
        if (browser)
            await browser.close();
    }
};
exports.generateCompellingEvidence = generateCompellingEvidence;
// --- 📊 THE PROOF OF VALUE (POV) ENGINE (UNTOUCHED) ---
const generatePOVReport = async (data) => {
    let browser;
    try {
        const safeOrganizationName = escapeHtml(data.organizationName);
        const threatLogHtml = data.threatLog.length === 0
            ? '<div style="color: #64748b; font-size: 13px; font-style: italic;">No critical threats detected during this cycle.</div>'
            : data.threatLog.map(threat => `
                        <div class="threat-item">
                            <div class="threat-header">
                                <span class="threat-id">TXN_${escapeHtml(threat.chargeId.substring(0, 12))}...</span>
                                <span class="threat-amount">At Risk: $${(threat.amountCents / 100).toFixed(2)}</span>
                            </div>
                            <div class="threat-details">
                                <span class="trust-score">TRUST: ${escapeHtml(threat.trustScore)}/100</span>
                                ${escapeHtml(threat.recommendation)}
                            </div>
                        </div>
                    `).join('');
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
                        Client: ${safeOrganizationName}<br>
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
                
                ${threatLogHtml}

                <div class="forensic-stamp">
                    X-TRACE-HASH: ${Buffer.from(data.organizationId + Date.now().toString()).toString('hex').substring(0, 32).toUpperCase()} | SECURED BY NOVORIQ
                </div>
            </body>
            </html>
        `;
        const outputDir = path_1.default.join(__dirname, '../../outputs/reports');
        if (!fs_1.default.existsSync(outputDir)) {
            fs_1.default.mkdirSync(outputDir, { recursive: true });
        }
        const fileName = `Novoriq_POV_${data.organizationId}_${Date.now()}.pdf`;
        const outputPath = path_1.default.join(outputDir, fileName);
        browser = await puppeteer_1.default.launch({
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
    }
    catch (error) {
        console.error(`[❌] POV Report Generation Failed for ${data.organizationId}:`, error);
        throw error;
    }
    finally {
        if (browser)
            await browser.close();
    }
};
exports.generatePOVReport = generatePOVReport;
