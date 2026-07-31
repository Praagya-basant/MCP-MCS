import { ItemThumbnail } from '@/shared/components/ItemThumbnail';

/** Thin panel-shaped wrapper around the generic ItemThumbnail — see that file for the actual rendering. */
export function PanelThumbnail({ panel, size = 'sm', className }) {
  return <ItemThumbnail imageUrl={panel?.image_url} label={panel?.panel_name} size={size} className={className} />;
}
