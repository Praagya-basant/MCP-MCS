/**
 * BASANT wordmark. `black` (public/logo-black.png) is for white/light
 * surfaces — sidebar, cards. `white` (public/logo-white.png) is for dark
 * surfaces — the login page's left panel. Both are the source lockup with
 * the "furniture I lighting I homedecor" tagline trimmed off, so callers
 * that want the tagline render it themselves as styled text.
 */
export function Logo({ variant = 'black', className }) {
  const src = variant === 'white' ? '/logo-white.png' : '/logo-black.png';
  return <img src={src} alt="BASANT" className={className} draggable={false} />;
}
