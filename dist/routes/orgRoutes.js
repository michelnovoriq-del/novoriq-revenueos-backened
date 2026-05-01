"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const orgController_1 = require("../controllers/orgController");
const trialController_1 = require("../controllers/trialController");
const auth_1 = require("../middleware/auth");
const gating_1 = require("../middleware/gating");
const router = (0, express_1.Router)();
// Standard Auth Protected Routes
router.get('/me', auth_1.requireAuth, orgController_1.getMyOrganization);
router.post('/trial', auth_1.requireAuth, trialController_1.activateTrial);
// TIER GATED ROUTE: Requires Auth AND an Active Subscription/Trial
router.get('/secure-recovery-action', auth_1.requireAuth, gating_1.requireActiveSubscription, (req, res) => {
    res.json({ message: "[🔓] ACTION PERMITTED: Generating PDF Evidence..." });
});
exports.default = router;
