#!/bin/bash

echo "[🚀] Initiating Day 22: Sealing the Vault with User IDs..."

# ==========================================
# 1. UPGRADE BACKEND WEBHOOK FOR USER ID TRACKING
# ==========================================
cat << 'CODE' > src/webhooks/whopWebhook.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const handleWhopWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
        const payload = req.body;
        
        if (payload.action === 'membership.went_valid') {
            let orgId = payload.data?.metadata?.organizationId;
            const userId = payload.data?.metadata?.userId; // The Master Key
            const subscriptionId = payload.data?.id;
            const planId = payload.data?.plan?.id || payload.data?.product?.id; 

            // BULLETPROOFING: If Whop missed the orgId but caught the userId, find it ourselves.
            if (!orgId && userId) {
                const user = await prisma.user.findUnique({ where: { id: userId } });
                if (user) orgId = user.organizationId;
            }

            if (orgId) {
                let newTier = 'PRO'; 
                let expiresAt = null;

                if (planId === 'plan_g5k8i3tfPkASV') {
                    newTier = 'TRIAL';
                    expiresAt = new Date();
                    expiresAt.setHours(expiresAt.getHours() + 48);
                } else if (planId === 'plan_pJpWvIqcYCRvV') {
                    newTier = 'TIER_1';
                } else if (planId === 'plan_rE4Rj9g9t8RNH') {
                    newTier = 'TIER_2';
                } else if (planId === 'plan_My5qZYNCRlcgr') {
                    newTier = 'TIER_3';
                }

                await prisma.organization.update({
                    where: { id: orgId },
                    data: { tier: newTier, whopSubscriptionId: subscriptionId, accessExpiresAt: expiresAt }
                });
                
                // Complete Audit Log
                console.log(`[💎] Whop Receipt Validated | User: ${userId || 'SYSTEM'} | Org: ${orgId} | Upgraded to: ${newTier}`);
            }
        }

        if (payload.action === 'membership.went_invalid') {
            let orgId = payload.data?.metadata?.organizationId;
            const userId = payload.data?.metadata?.userId;
            
            if (!orgId && userId) {
                const user = await prisma.user.findUnique({ where: { id: userId } });
                if (user) orgId = user.organizationId;
            }

            if (orgId) {
                await prisma.organization.update({
                    where: { id: orgId },
                    data: { tier: 'INACTIVE', accessExpiresAt: null }
                });
                console.log(`[⚠️] Whop Downgrade | User: ${userId || 'SYSTEM'} | Org: ${orgId} | Locked.`);
            }
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error("[CRITICAL] Webhook processing failed:", error);
        res.status(400).json({ error: 'Webhook handler failed' });
    }
};
CODE

echo "[✅] Backend Webhook sealed. Restarting backend process..."
# Restarting the backend silently in the background so we don't break the script flow
pm2 restart all 2>/dev/null || echo "-> Note: Remember to manually restart your backend if not using pm2."

# ==========================================
# 2. UPGRADE FRONTEND TO INJECT USER ID INTO LINKS
# ==========================================
cd ../novoriq-dashboard

# Patch the Demo Sandbox Page
cat << 'CODE' > src/app/demo/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { Activity, ShieldCheck, FileText, Download, Zap } from 'lucide-react';

export default function DemoPage() {
    const router = useRouter();
    const [orgId, setOrgId] = useState('');
    const [userId, setUserId] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('novoriq_token');
        if (!token) return router.push('/login');
        try {
            const decoded: any = jwtDecode(token);
            setOrgId(decoded.organizationId);
            setUserId(decoded.userId || decoded.id); // Capture the specific User ID
        } catch (e) { router.push('/login'); }
    }, []);

    // DOUBLE METADATA INJECTION: Org ID + User ID
    const trialLink = `https://whop.com/checkout/plan_g5k8i3tfPkASV?metadata[organizationId]=${orgId}&metadata[userId]=${userId}`;

    const simulatedDisputes = [
        { id: '1', stripeId: 'dp_1Q8zxX...', amount: 49900, reason: 'fraudulent', status: 'won', hasPdf: true },
        { id: '2', stripeId: 'dp_2K9amP...', amount: 125000, reason: 'product_not_received', status: 'won', hasPdf: true },
        { id: '3', stripeId: 'dp_3J7bnQ...', amount: 8900, reason: 'unrecognized', status: 'needs_response', hasPdf: false }
    ];

    const downloadFakePdf = () => alert("DEMO MODE: Activate your 48-Hour Trial to generate Compelling Evidence.");

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 w-full p-4 text-center text-white flex flex-col md:flex-row items-center justify-center gap-4 shadow-md sticky top-0 z-50">
                <span className="font-semibold text-lg flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-300"/> SANDBOX MODE ACTIVE</span>
                <span className="hidden md:inline text-blue-200">|</span>
                <span className="text-sm">See how much revenue you could recover.</span>
                <a href={trialLink} className="bg-white text-blue-700 font-bold px-6 py-2 rounded-full text-sm hover:bg-slate-100 transition-colors">
                    Start 48-Hour Live Trial ($10)
                </a>
            </div>

            <div className="max-w-6xl mx-auto p-8 space-y-8 mt-4 filter opacity-90 grayscale-[10%] pointer-events-auto">
                <h1 className="text-3xl font-bold text-slate-900">Revenue OS (Simulated)</h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><div className="flex items-center gap-3 text-slate-500 mb-2"><Activity className="w-5 text-blue-500" /> Tracked Disputes</div><div className="text-3xl font-bold">142</div></div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-green-500"><div className="flex items-center gap-3 text-slate-500 mb-2"><ShieldCheck className="w-5 text-green-500" /> Revenue Recovered</div><div className="text-3xl font-bold text-green-600">$18,450.00</div></div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><div className="flex items-center gap-3 text-slate-500 mb-2"><FileText className="w-5 text-purple-500" /> Evidence Generated</div><div className="text-3xl font-bold">118 / 120</div></div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-200"><h2 className="font-semibold text-lg">Simulated Ledger</h2></div>
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500"><tr><th className="px-6 py-3">ID</th><th className="px-6 py-3">Amount</th><th className="px-6 py-3">Status</th><th className="px-6 py-3 text-right">Evidence</th></tr></thead>
                        <tbody>
                            {simulatedDisputes.map(d => (
                                <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50">
                                    <td className="px-6 py-4 font-mono text-slate-500">{d.stripeId}</td><td className="px-6 py-4 font-bold text-slate-700">${(d.amount / 100).toFixed(2)}</td><td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${d.status==='won'?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>{d.status}</span></td><td className="px-6 py-4 text-right">{d.hasPdf ? <button onClick={downloadFakePdf} className="text-blue-600 font-medium flex items-center justify-end gap-1 w-full"><Download className="w-4"/> Preview PDF</button> : <span className="text-slate-400">Processing...</span>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
CODE

# Patch the Pricing Page
cat << 'CODE' > src/app/pricing/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { Activity, ShieldCheck, FileText, Lock } from 'lucide-react';

export default function PricingPage() {
    const router = useRouter();
    const [orgId, setOrgId] = useState('');
    const [userId, setUserId] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('novoriq_token');
        if (!token) return router.push('/login');
        try {
            const decoded: any = jwtDecode(token);
            setOrgId(decoded.organizationId);
            setUserId(decoded.userId || decoded.id);
        } catch (e) { router.push('/login'); }
    }, []);

    // DOUBLE METADATA INJECTION
    const whopBaseParams = `?metadata[organizationId]=${orgId}&metadata[userId]=${userId}`;
    const links = {
        tier1: `https://whop.com/checkout/plan_pJpWvIqcYCRvV${whopBaseParams}`,
        tier2: `https://whop.com/checkout/plan_rE4Rj9g9t8RNH${whopBaseParams}`,
        tier3: `https://whop.com/checkout/plan_My5qZYNCRlcgr${whopBaseParams}`
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <div className="max-w-5xl mx-auto mt-12 text-center mb-16">
                <Lock className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                <h1 className="text-4xl font-bold mb-4">Trial Expired. Upgrade to Maintain Defense.</h1>
                <p className="text-slate-400">Your 48-hour access has concluded. Select a tier to re-engage your automated recovery engine.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8">
                    <h3 className="text-2xl font-bold mb-1">Starter</h3><div className="text-4xl font-bold mb-6">$199<span className="text-lg text-slate-500">/mo</span></div>
                    <ul className="space-y-4 mb-8"><li className="flex gap-3"><FileText className="w-5 text-blue-400"/> 50 PDFs</li><li className="flex gap-3"><Activity className="w-5 text-blue-400"/> 10% Fee</li></ul>
                    <a href={links.tier1} className="w-full block text-center bg-slate-700 hover:bg-slate-600 py-3 rounded-xl">Select Starter</a>
                </div>
                <div className="bg-slate-800 border border-blue-500 rounded-2xl p-8 transform md:-translate-y-4 shadow-xl">
                    <h3 className="text-2xl font-bold mb-1">Pro</h3><div className="text-4xl font-bold mb-6">$399<span className="text-lg text-slate-500">/mo</span></div>
                    <ul className="space-y-4 mb-8"><li className="flex gap-3"><FileText className="w-5 text-blue-400"/> 80 PDFs</li><li className="flex gap-3"><Activity className="w-5 text-blue-400"/> 5% Fee</li><li className="flex gap-3"><ShieldCheck className="w-5 text-blue-400"/> Golden Trio</li></ul>
                    <a href={links.tier2} className="w-full block text-center bg-blue-600 hover:bg-blue-500 py-3 rounded-xl">Select Pro</a>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8">
                    <h3 className="text-2xl font-bold mb-1">Premium</h3><div className="text-4xl font-bold mb-6">$799<span className="text-lg text-slate-500">/mo</span></div>
                    <ul className="space-y-4 mb-8"><li className="flex gap-3"><FileText className="w-5 text-blue-400"/> 120 PDFs</li><li className="flex gap-3"><Activity className="w-5 text-blue-400"/> 3.5% Fee</li></ul>
                    <a href={links.tier3} className="w-full block text-center bg-slate-700 hover:bg-slate-600 py-3 rounded-xl">Select Premium</a>
                </div>
            </div>
        </div>
    );
}
CODE

echo "[✅] Frontend UX sealed with User IDs. Restarting Next.js..."
npm run dev
