import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader } from '@/core/components/PageHeader';
import { PillTabs } from '@/core/components/PillTabs';
import { UsersPanel } from '@/admin/components/UsersPanel';
import { BuyersPanel } from '@/admin/components/BuyersPanel';

const TABS = [
  { value: 'users', label: 'Users' },
  { value: 'buyers', label: 'Buyers' },
];

/**
 * Merges the old standalone /admin/users and /admin/buyers pages into one
 * route with pill tabs — Users and Buyers each keep their own panel
 * component (own data fetch, own modals) unchanged, just without their
 * own PageHeader. Defaults to the Users tab; callers that want to land
 * on Buyers (e.g. the admin dashboard's quick-view panels) can pass
 * `state: { tab: 'buyers' }` via navigate().
 */
export default function Team() {
  const location = useLocation();
  const [tab, setTab] = useState(location.state?.tab === 'buyers' ? 'buyers' : 'users');

  return (
    <div>
      <PageHeader title="Team & Buyers" description="Everyone with a login, and every buyer they work with." />

      <div className="mb-6">
        <PillTabs options={TABS} value={tab} onChange={setTab} />
      </div>

      {tab === 'users' ? <UsersPanel /> : <BuyersPanel />}
    </div>
  );
}
