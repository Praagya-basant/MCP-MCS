import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import { getSampleByBtCode } from '@/modules/mcs/api/samplesApi';
import { ROLES } from '@/shared/utils/constants';
import { Button } from '@/shared/components/Button';

const SAMPLES_ROUTE = {
  [ROLES.SUPER_ADMIN]: '/admin/samples',
  [ROLES.HALL_MANAGER]: '/hall/samples',
  [ROLES.MERCHANT]: '/merchant/samples',
};

/**
 * Landing point for the "View Sample" email link
 * (https://mcp-mcs.vercel.app/sample/:btCode). Sits behind ProtectedRoute
 * so an unauthenticated visit already round-trips through
 * /login?redirectTo=/sample/:btCode first. Once authenticated, looks the
 * sample up (RLS-scoped, so a merchant can't be linked into another
 * buyer's sample) and hands off to that role's sample list with the
 * detail drawer pre-opened.
 */
export default function SampleRedirect() {
  const { btCode } = useParams();
  const { role } = useAuth();
  const navigate = useNavigate();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getSampleByBtCode(btCode)
      .then((sample) => {
        if (cancelled) return;
        if (!sample) {
          setNotFound(true);
          return;
        }
        navigate(SAMPLES_ROUTE[role] || '/', { replace: true, state: { openSampleId: sample.id } });
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });

    return () => {
      cancelled = true;
    };
  }, [btCode, role, navigate]);

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg px-4 text-center">
        <h1 className="text-heading font-semibold text-ink">Sample not found</h1>
        <p className="mt-1 text-body text-ink-secondary">
          We couldn't find a sample with BT code "{btCode}".
        </p>
        <Link to="/" className="mt-6">
          <Button>Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="w-6 h-6 border-2 border-border-strong border-t-ink rounded-full animate-spin" />
    </div>
  );
}
