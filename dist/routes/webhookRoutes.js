"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const whopWebhook_1 = require("../webhooks/whopWebhook");
const router = (0, express_1.Router)();
// Route: POST /api/webhooks/whop
// Whop sends POST requests here
router.post('/whop', whopWebhook_1.handleWhopWebhook);
exports.default = router;
