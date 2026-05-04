"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboardController_1 = require("../controllers/dashboardController");
const auth_1 = require("../middleware/auth");
const gating_1 = require("../middleware/gating");
const router = (0, express_1.Router)();
router.post('/keys', auth_1.requireAuth, gating_1.requireActiveSubscription, dashboardController_1.connectStripeKey);
router.get('/metrics', auth_1.requireAuth, dashboardController_1.getMetrics);
router.get('/disputes', auth_1.requireAuth, gating_1.requireActiveSubscription, dashboardController_1.getDisputes);
router.get('/disputes/:id/pdf', auth_1.requireAuth, gating_1.requireActiveSubscription, dashboardController_1.downloadEvidencePdf);
// --- 📊 PHASE 4: PROOF OF VALUE (POV) DASHBOARD DOWNLOAD ---
// Note: I adjusted the middleware to use your existing 'requireAuth' to keep the code clean.
router.get('/reports/pov', auth_1.requireAuth, gating_1.requireActiveSubscription, dashboardController_1.downloadPOVReport);
exports.default = router;
