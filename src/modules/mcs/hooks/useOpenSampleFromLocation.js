import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Auto-opens a sample's detail drawer when arriving via the
 * /sample/:btCode email deep link (SampleRedirect hands off
 * `location.state.openSampleId` once it resolves the BT code). A ref
 * guards against re-triggering on later `samples` refetches — e.g. after
 * issuing/returning the sample from inside the drawer itself.
 */
export function useOpenSampleFromLocation(samples, setSelected) {
  const location = useLocation();
  const consumed = useRef(false);

  useEffect(() => {
    if (consumed.current || !samples) return;
    const openId = location.state?.openSampleId;
    if (!openId) return;
    const match = samples.find((s) => s.id === openId);
    if (match) {
      setSelected(match);
      consumed.current = true;
    }
  }, [samples, location.state, setSelected]);
}
