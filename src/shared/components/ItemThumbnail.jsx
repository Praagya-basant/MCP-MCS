import { cn } from '@/shared/utils/cn';

/**
 * Generic image-with-fallback thumbnail (first letter of `label` on a
 * warm accent-tinted tile when there's no `imageUrl`) — the shape MCS's
 * SampleThumbnail and MCP's PanelThumbnail both delegate to, since "a
 * sample" and "a panel" are otherwise identical here (an image, a name).
 * `sm` is the 48x48 desktop table-row thumbnail, `md` the 64x64 mobile
 * card thumbnail, `lg` the full-bleed 200px-tall drawer header.
 */
export function ItemThumbnail({ imageUrl, label, size = 'sm', className }) {
  const letter = label?.[0]?.toUpperCase() || '?';

  if (size === 'lg') {
    return imageUrl ? (
      <img src={imageUrl} alt={label} className={cn('w-full h-[200px] object-cover', className)} />
    ) : (
      <div
        className={cn(
          'w-full h-[200px] flex items-center justify-center bg-gradient-to-br from-accent/20 to-accent/5 text-accent text-display font-bold',
          className
        )}
      >
        {letter}
      </div>
    );
  }

  const dims = size === 'md' ? 'w-16 h-16 rounded-xl' : 'w-12 h-12 rounded-md';

  return imageUrl ? (
    <img
      src={imageUrl}
      alt={label}
      className={cn(dims, 'object-cover border border-border shrink-0', className)}
      loading="lazy"
    />
  ) : (
    <div
      className={cn(
        dims,
        'bg-accent/12 text-accent flex items-center justify-center font-semibold shrink-0',
        size === 'md' ? 'text-body-lg' : 'text-body',
        className
      )}
    >
      {letter}
    </div>
  );
}
