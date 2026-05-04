"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const billingController_1 = require("../controllers/billingController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/checkout', auth_1.requireAuth, billingController_1.createCheckoutUrl);
exports.default = router;
