import dotenv from 'dotenv';
dotenv.config();
import jwt from 'jsonwebtoken';

console.log("\n[🔒] Executing Novoriq JWT Engine...");

const JWT_SECRET = process.env.JWT_SECRET as string;

// Simulate a user logging in
const mockPayload = {
    userId: "user_123",
    organizationId: "org_999", // The most critical piece of data
    role: "ADMIN"
};

console.log("Original Payload: ", mockPayload);

// Sign the token (Valid for 24 hours)
const token = jwt.sign(mockPayload, JWT_SECRET, { expiresIn: '24h' });
console.log("\nGenerated JWT VIP Pass:\n", token);

// Simulate the Middleware verifying the token
try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("\n[✅] SUCCESS: Token verified. Extracted Data:");
    console.log(decoded);
} catch (err) {
    console.log("\n[❌] FAILURE: Token verification failed.");
}
