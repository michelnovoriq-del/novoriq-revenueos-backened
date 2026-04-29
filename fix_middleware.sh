#!/bin/bash

echo "[🔧] Engineering correction: Rebuilding auth middleware..."

# 1. Ensure the directory exists
mkdir -p src/middleware

# 2. Write the complete, production-grade authentication middleware
cat << 'CODE' > src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request to enforce Multi-Tenant isolation
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
    if (!JWT_SECRET) throw new Error("Critical: Missing JWT_SECRET in environment");

    // Cryptographically verify the VIP Pass
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Inject the multi-tenant payload into the request pipeline
    req.user = {
      userId: decoded.userId,
      organizationId: decoded.organizationId,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized: Token is invalid or expired.' });
    return;
  }
}
CODE

echo "[✅] Middleware vault restored. Executing network audit..."
npx ts-node src/test_day5.ts
