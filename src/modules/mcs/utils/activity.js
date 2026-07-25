/**
 * Merges movements + recalls into one timestamp-sorted feed for the
 * dashboard activity widgets. A single movement row can produce two
 * events (issued at picked_at, then returned at returned_at) since both
 * are meaningful, distinct moments in the sample's timeline.
 */
export function buildActivityFeed({ movements = [], recalls = [] }) {
  const items = [];

  movements.forEach((m) => {
    items.push({
      id: `${m.id}-issue`,
      type: 'issue',
      timestamp: m.picked_at,
      sample: m.sample,
      text: `issued to ${m.picked_by_name} · ${m.destination}`,
    });
    if (m.status === 'returned' && m.returned_at) {
      items.push({
        id: `${m.id}-return`,
        type: 'return',
        timestamp: m.returned_at,
        sample: m.sample,
        text: `returned by ${m.picked_by_name}`,
      });
    }
  });

  recalls.forEach((r) => {
    items.push({
      id: `${r.id}-recall`,
      type: 'recall',
      timestamp: r.created_at,
      sample: r.sample,
      text: 'recall requested',
    });
  });

  return items
    .filter((i) => i.timestamp)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}
