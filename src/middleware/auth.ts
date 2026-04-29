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
    // Added a fallback for .id just in case older tokens use that format
    req.user = {
      userId: decoded.userId || decoded.id,
      organizationId: decoded.organizationId,
      role: decoded.role || 'ADMIN'
    };
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized: Token is invalid or expired.' });
    return;
  }
}