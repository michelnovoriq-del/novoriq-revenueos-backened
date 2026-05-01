"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: Missing or invalid token format.' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET)
            throw new Error("Critical: Missing JWT_SECRET in environment");
        // Cryptographically verify the VIP Pass
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Inject the multi-tenant payload into the request pipeline
        // Added a fallback for .id just in case older tokens use that format
        req.user = {
            userId: decoded.userId || decoded.id,
            organizationId: decoded.organizationId,
            role: decoded.role || 'ADMIN'
        };
        next();
    }
    catch (error) {
        res.status(401).json({ error: 'Unauthorized: Token is invalid or expired.' });
        return;
    }
}
