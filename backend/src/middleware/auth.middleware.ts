import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'G4rud4-Ant1Drug-Pl4tf0rm-S3cur3-K3y-2026-M1n1mum-256-B1t-L3ngth!!';

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Extract token from Authorization header or query param (for SSE/EventSource)
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader) {
    token = authHeader.split(' ')[1];
  } else if (typeof req.query.token === 'string') {
    // SSE (EventSource) can't set headers, so token comes via query param
    token = req.query.token;
  }

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err: jwt.VerifyErrors | null, user: any) => {
    if (err) {
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
};
