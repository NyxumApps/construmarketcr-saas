import type { ReactNode } from 'react';
import { CloudOff, Inbox, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { describeError } from '@/lib/errors';
import { cn } from '@/lib/utils';

type StatusMessageProps = {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  footnote?: string;
  className?: string;
  role?: 'alert' | 'status';
};

function StatusMessage({ icon, title, description, action, footnote, className, role }: StatusMessageProps) {
  return (
    <div
      role={role}
      className={cn(
        'flex flex-col items-center text-center py-16 px-6 bg-muted/20 rounded-2xl border border-dashed',
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <h2 className="text-lg font-display font-bold text-foreground mb-1">{title}</h2>
      <p className="text-muted-foreground max-w-md">{description}</p>
      {action && <div className="mt-6">{action}</div>}
      {footnote && <p className="mt-4 text-xs text-muted-foreground">{footnote}</p>}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  isRetrying = false,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
}) {
  const friendly = describeError(error);
  return (
    <StatusMessage
      role="alert"
      className={className}
      icon={<CloudOff className="h-6 w-6" aria-hidden="true" />}
      title={friendly.title}
      description={friendly.description}
      footnote={friendly.reference ? `Referencia para soporte: ${friendly.reference}` : undefined}
      action={
        friendly.retryable && onRetry ? (
          <Button onClick={onRetry} disabled={isRetrying} variant="outline">
            <RefreshCw className={cn('mr-2 h-4 w-4', isRetrying && 'animate-spin')} aria-hidden="true" />
            {isRetrying ? 'Intentando…' : 'Intentar de nuevo'}
          </Button>
        ) : undefined
      }
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <StatusMessage
      role="status"
      className={className}
      icon={<Inbox className="h-6 w-6" aria-hidden="true" />}
      title={title}
      description={description}
      action={action}
    />
  );
}
