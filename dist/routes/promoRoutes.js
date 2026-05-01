"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const promoController_1 = require("../controllers/promoController");
const router = (0, express_1.Router)();
// Endpoint: POST /api/promo/redeem
router.post('/redeem', promoController_1.redeemPromo);
exports.default = router;
