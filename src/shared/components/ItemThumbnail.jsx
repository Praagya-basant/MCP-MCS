import { cn } from '@/shared/utils/cn';

/**
 * Generic image-with-fallback thumbnail (first letter of `label` on a gray
 * tile when there's no `imageUrl`) — the shape MCS's SampleThumbnail and
 * MCP's PanelThumbnail both delegate to, since "a sample" and "a panel"
 * are otherwise identical here (an image, a name). `sm` is the 48x48
 * list-row thumbnail; `lg` is the full-bleed 200px-tall drawer header.
 */
export function ItemThumbnail({ imageUrl, label, size = 'sm', className }) {
  const letter = label?.[0]?.toUpperCase() || '?';

  if (size === 'lg') {
    return imageUrl ? (
      <img src={imageUrl} alt={label} className={cn('w-full h-[200px] object-cover', className)} />
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

  return imageUrl ? (
    <img
      src={imageUrl}
      alt={label}
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
