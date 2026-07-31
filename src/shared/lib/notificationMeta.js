import {
  IconMove,
  IconHistory,
  IconAlert,
  IconLayers,
} from '@/shared/components/icons';

// icon + tone (reuses StatCard/Badge's tone vocabulary) per notification
// type — purely presentational grouping, doesn't touch the type strings
// themselves (those are the edge function's contract, see send-notification).
const META = {
  checkout: { icon: IconMove, tone: 'warning' },
  panel_checkout: { icon: IconMove, tone: 'warning' },
  forward: { icon: IconMove, tone: 'info' },
  panel_forward: { icon: IconMove, tone: 'info' },
  return: { icon: IconMove, tone: 'success' },
  panel_return: { icon: IconMove, tone: 'success' },
  recall: { icon: IconAlert, tone: 'error' },
  validity_alert: { icon: IconHistory, tone: 'warning' },
  validity_requested: { icon: IconHistory, tone: 'warning' },
  validity_extended: { icon: IconHistory, tone: 'info' },
  panel_validity_requested: { icon: IconHistory, tone: 'warning' },
  panel_validity_extended: { icon: IconHistory, tone: 'info' },
  shift_requested: { icon: IconLayers, tone: 'info' },
  shift_approved: { icon: IconLayers, tone: 'success' },
  shift_rejected: { icon: IconLayers, tone: 'error' },
  panel_retired: { icon: IconLayers, tone: 'neutral' },
};

const DEFAULT_META = { icon: IconHistory, tone: 'neutral' };

export function getNotificationMeta(type) {
  return META[type] || DEFAULT_META;
}
