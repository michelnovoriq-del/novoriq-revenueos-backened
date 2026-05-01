"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
console.log("\n[🔒] Executing Novoriq JWT Engine...");
const JWT_SECRET = process.env.JWT_SECRET;
// Simulate a user logging in
const mockPayload = {
    userId: "user_123",
    organizationId: "org_999", // The most critical piece of data
    role: "ADMIN"
};
console.log("Original Payload: ", mockPayload);
// Sign the token (Valid for 24 hours)
const token = jsonwebtoken_1.default.sign(mockPayload, JWT_SECRET, { expiresIn: '24h' });
console.log("\nGenerated JWT VIP Pass:\n", token);
// Simulate the Middleware verifying the token
try {
    const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
    console.log("\n[✅] SUCCESS: Token verified. Extracted Data:");
    console.log(decoded);
}
catch (err) {
    console.log("\n[❌] FAILURE: Token verification failed.");
}
