import { cn } from '../lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'rectangular' | 'circular' | 'rounded';
  pulse?: boolean;
  style?: React.CSSProperties;
}

export function Skeleton({ className, variant = 'rectangular', pulse = true, style }: SkeletonProps) {
  const shapes = {
    rectangular: 'rounded-lg',
    circular: 'rounded-full',
    rounded: 'rounded-xl',
  };

  return (
    <div
      className={cn(
        'bg-white/5',
        shapes[variant],
        pulse && 'animate-pulse',
        className,
      )}
      style={style}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="p-4 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton variant="circular" className="h-8 w-8" />
      </div>
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}

export function TextSkeleton({ lines = 3, lastLineWidth = '60%' }: { lines?: number; lastLineWidth?: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          style={i === lines - 1 ? { width: lastLineWidth } : { width: '100%' }}
        />
      ))}
    </div>
  );
}
