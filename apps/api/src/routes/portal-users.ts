// Portal user routes.
//
//   GET    /api/portal-users          → list everyone with login access
//   GET    /api/portal-users/by-email → look up by ?email=…
//   GET    /api/portal-users/:id      → single record
//   POST   /api/portal-users          → invite (creates row, no password yet)
//   PATCH  /api/portal-users/:id      → role/name/jobs/notes update
//   DELETE /api/portal-users/:id      → revoke access (refuses last PRESIDENT/VP)

import { Router } from 'express';
import {
  PortalUserCreateSchema,
  PortalUserPatchSchema,
} from '@yge/shared';
import {
  createPortalUser,
  deletePortalUser,
  getPortalUser,
  getPortalUserByEmail,
  listPortalUsers,
  updatePortalUser,
} from '../lib/portal-users-store';

export const portalUsersRouter = Router();

portalUsersRouter.get('/', async (_req, res, next) => {
  try {
    const users = await listPortalUsers();
    return res.json({ users });
  } catch (err) {
    next(err);
  }
});

portalUsersRouter.get('/by-email', async (req, res, next) => {
  try {
    const email = typeof req.query.email === 'string' ? req.query.email : '';
    if (!email) return res.status(400).json({ error: 'email is required' });
    const user = await getPortalUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'Not found' });
    return res.json({ user });
  } catch (err) {
    next(err);
  }
});

portalUsersRouter.get('/:id', async (req, res, next) => {
  try {
    const user = await getPortalUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    return res.json({ user });
  } catch (err) {
    next(err);
  }
});

portalUsersRouter.post('/', async (req, res, next) => {
  try {
    const parsed = PortalUserCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const user = await createPortalUser(parsed.data);
    return res.status(201).json({ user });
  } catch (err) {
    if (err instanceof Error && /already exists/i.test(err.message)) {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
});

portalUsersRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = PortalUserPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updatePortalUser(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    return res.json({ user: updated });
  } catch (err) {
    next(err);
  }
});

portalUsersRouter.delete('/:id', async (req, res, next) => {
  try {
    const ok = await deletePortalUser(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    return res.json({ deleted: true });
  } catch (err) {
    if (err instanceof Error && /Refusing/i.test(err.message)) {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
});
