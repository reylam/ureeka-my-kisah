import { useLocation, useNavigate } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

export function NotFoundPage() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Card className="mx-auto max-w-lg">
      <EmptyState
        icon={<Compass />}
        title="This page does not exist"
        description={
          <>
            Nothing is routed to{' '}
            <code className="rounded bg-obsidian-100 px-1.5 py-0.5 font-mono text-xs text-obsidian-700">
              {location.pathname}
            </code>
            . Use the navigation to get back to a working screen.
          </>
        }
        action={
          <Button
            variant="primary"
            leadingIcon={<Home className="size-4" />}
            onClick={() => navigate('/dashboard')}
          >
            Go to dashboard
          </Button>
        }
      />
    </Card>
  );
}
