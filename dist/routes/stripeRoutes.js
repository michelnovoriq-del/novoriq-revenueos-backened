"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboardController_1 = require("../controllers/dashboardController");
const router = (0, express_1.Router)();
// Multi-tenant endpoint: Captures the organization ID directly from the URL.
// 🚨 FIXED: Changed from :organizationId to :orgId to match the webhook code perfectly.
router.post('/:orgId', dashboardController_1.handleStripeWebhook);
exports.default = router;
