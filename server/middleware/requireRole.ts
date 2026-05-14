import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { AppRole } from '../db/database.types.js';

/**
 * IDOR guard for routes like GET /suppliers/:id/documents.
 * Non-supplier roles pass through; supplier role may only access the supplier linked
 * via profiles.supplier_id (must match req.params.id).
 */
export async function requireSupplierOwnership(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const targetSupplierId = req.params.id as string | undefined;
  if (!targetSupplierId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { supabase } = await import('../db/supabaseClient.js');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, supplier_id')
    .eq('id', req.userId)
    .single();

  if (profileError || !profile) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (profile.role !== 'supplier') {
    return next();
  }

  if (profile.supplier_id == null || profile.supplier_id !== targetSupplierId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}

export function requireRole(...allowedRoles: AppRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const role = req.userRole as AppRole | undefined;

    if (!role) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}
