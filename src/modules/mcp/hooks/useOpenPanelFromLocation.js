import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/** Mirrors MCS's useOpenSampleFromLocation — auto-opens a panel's drawer when arriving with `location.state.openPanelId` set (see NotificationBell). */
export function useOpenPanelFromLocation(panels, setSelected) {
  const location = useLocation();
  const consumed = useRef(false);

  useEffect(() => {
    if (consumed.current || !panels) return;
    const openId = location.state?.openPanelId;
    if (!openId) return;
    const match = panels.find((p) => p.id === openId);
    if (match) {
      setSelected(match);
      consumed.current = true;
    }
  }, [panels, location.state, setSelected]);
}
