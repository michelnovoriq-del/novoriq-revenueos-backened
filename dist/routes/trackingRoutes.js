"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const trackingController_1 = require("../controllers/trackingController");
const router = (0, express_1.Router)();
// Endpoint for the merchant's website to post data to
router.post('/', trackingController_1.ingestTrackingData);
exports.default = router;
