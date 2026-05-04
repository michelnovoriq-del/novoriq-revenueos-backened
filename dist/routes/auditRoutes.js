"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auditController_1 = require("../controllers/auditController");
const router = (0, express_1.Router)();
router.post('/bleed-report', auditController_1.generateBleedReport);
exports.default = router;
