// POST /api/login — email + password → mobile session token.

import { Router } from 'express';
import { z } from 'zod';
import { verifyPassword } from '../lib/credentials-store';
import { issueToken } from '../lib/session-token';

export const loginRouter = Router();

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

loginRouter.post('/', async (req, res, next) => {
  try {
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed' });
    }
    const ok = await verifyPassword(parsed.data.email, parsed.data.password);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = issueToken({ email: parsed.data.email });
    return res.json({
      token,
      user: { email: parsed.data.email },
    });
  } catch (err) {
    next(err);
  }
});
