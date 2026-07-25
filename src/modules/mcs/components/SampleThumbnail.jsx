import { cn } from '@/shared/utils/cn';

/**
 * Sample image with a graceful fallback (first letter of the product name
 * on a gray tile) when no image was uploaded. `sm` is the 48x48 list-row
 * thumbnail; `lg` is the full-bleed 200px-tall drawer header image.
 */
export function SampleThumbnail({ sample, size = 'sm', className }) {
  const letter = sample?.product_name?.[0]?.toUpperCase() || '?';

  if (size === 'lg') {
    return sample?.image_url ? (
      <img
        src={sample.image_url}
        alt={sample.product_name}
        className={cn('w-full h-[200px] object-cover', className)}
      />
    ) : (
      <div
        className={cn(
          'w-full h-[200px] flex items-center justify-center bg-surface-subtle text-ink-muted text-display font-semibold',
          className
        )}
      >
        {letter}
      </div>
    );
  }

  return sample?.image_url ? (
    <img
      src={sample.image_url}
      alt={sample.product_name}
      className={cn('w-12 h-12 rounded-md object-cover border border-border shrink-0', className)}
    />
  ) : (
    <div
      className={cn(
        'w-12 h-12 rounded-md bg-surface-subtle text-ink-muted flex items-center justify-center text-body font-semibold shrink-0',
        className
      )}
    >
      {letter}
    </div>
  );
}
