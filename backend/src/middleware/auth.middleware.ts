import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'G4rud4-Ant1Drug-Pl4tf0rm-S3cur3-K3y-2026-M1n1mum-256-B1t-L3ngth!!';

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];
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
  } else {
    res.sendStatus(401);
  }
};
