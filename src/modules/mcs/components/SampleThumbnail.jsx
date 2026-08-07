import { ItemThumbnail } from '@/core/components/ItemThumbnail';

/** Thin sample-shaped wrapper around the generic ItemThumbnail — see that file for the actual rendering. */
export function SampleThumbnail({ sample, size = 'sm', className }) {
  return <ItemThumbnail imageUrl={sample?.image_url} label={sample?.product_name} size={size} className={className} />;
}
