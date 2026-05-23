import { Request } from 'express';

export function paramId(req: Request, key = 'id'): bigint {
  const v = req.params[key];
  const s = Array.isArray(v) ? v[0] : v;
  if (!s) throw new Error(`Missing route param: ${key}`);
  return BigInt(s);
}
