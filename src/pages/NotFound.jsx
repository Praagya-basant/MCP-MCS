import { Link } from 'react-router-dom';
import { Button } from '@/shared/components/Button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg px-4 text-center">
      <span className="text-display font-semibold text-ink">404</span>
      <h1 className="mt-2 text-body-lg font-semibold text-ink">Page not found</h1>
      <p className="mt-1 text-body text-ink-secondary">The page you're looking for doesn't exist.</p>
      <Link to="/" className="mt-6">
        <Button>Back to Home</Button>
      </Link>
    </div>
  );
}
