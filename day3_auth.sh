#!/bin/bash

echo "[🚀] Initiating Day 3: Multi-Tenant Authentication & JWTs..."

# 1. Install required packages and their TypeScript types
npm install jsonwebtoken bcrypt
npm install @types/jsonwebtoken @types/bcrypt --save-dev

# 2. Generate a secure JWT Secret and append to .env
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "JWT_SECRET=\"$JWT_SECRET\"" >> .env
echo "[✅] JWT_SECRET generated and locked in .env."

# 3. Create the Authentication Middleware
cat << 'CODE' > src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// We extend the default Express Request to include our Multi-Tenant User data
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    organizationId: string;
    role: string;
  };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid token format.' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) throw new Error("Server Error: Missing JWT_SECRET");

    // Verify token cryptographically
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Inject the user's multi-tenant payload directly into the request
    req.user = {
      userId: decoded.userId,
      organizationId: decoded.organizationId,
      role: decoded.role
    };
    
    next(); // Pass control to the actual route handler
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized: Token is invalid or expired.' });
    return;
  }
}
CODE
echo "[✅] Multi-Tenant Auth Middleware created at src/middleware/auth.ts"

# 4. Create an immediate verification script
cat << 'TEST' > src/test_jwt.ts
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
TEST

# 5. Run the verification script immediately
npx ts-node src/test_jwt.ts

