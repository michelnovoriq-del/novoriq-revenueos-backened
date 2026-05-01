"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController_1 = require("../controllers/adminController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/organizations', auth_1.requireAuth, adminController_1.getAllOrganizations);
router.post('/resolve-won', auth_1.requireAuth, adminController_1.markDisputeWon);
exports.default = router;
