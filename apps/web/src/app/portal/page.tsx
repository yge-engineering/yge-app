// /portal — role-aware redirect landing.

import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/auth';

export default function PortalRouterPage() {
  const me = getCurrentUser();
  if (!me) redirect('/login');
  switch (me.role) {
    case 'EXTERNAL_OWNER':
      redirect('/portal/owner');
    case 'EXTERNAL_SUB':
      redirect('/portal/sub');
    case 'EXTERNAL_BOND':
      redirect('/portal/bond');
    default:
      redirect('/dashboard');
  }
}
