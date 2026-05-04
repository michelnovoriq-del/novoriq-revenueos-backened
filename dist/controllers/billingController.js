"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheckoutUrl = void 0;
const CHECKOUTS = {
    beta: {
        baseUrl: 'https://whop.com/checkout/plan_g5k8i3tfPkASV',
        planId: 'plan_g5k8i3tfPkASV'
    },
    e2e: {
        baseUrl: 'https://whop.com/novoriq-revenue-os/novoriq-revenue-flow/',
        planId: 'plan_12uLHFgtctUFl'
    }
};
const createCheckoutUrl = (req, res) => {
    const flow = req.body?.flow;
    const orgId = req.user?.organizationId;
    const userId = req.user?.userId;
    if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized: Missing billing identity.' });
        return;
    }
    if (!flow || !CHECKOUTS[flow]) {
        res.status(400).json({ error: 'Invalid checkout flow.' });
        return;
    }
    const checkout = CHECKOUTS[flow];
    const url = new URL(checkout.baseUrl);
    url.searchParams.set('external_id', orgId);
    url.searchParams.set('plan_id', checkout.planId);
    url.searchParams.set('metadata[organizationId]', orgId);
    url.searchParams.set('metadata[userId]', userId);
    res.json({ url: url.toString(), planId: checkout.planId, flow });
};
exports.createCheckoutUrl = createCheckoutUrl;
