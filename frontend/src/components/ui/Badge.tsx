import React from 'react';

export type BadgeVariant = 'green' | 'blue' | 'yellow' | 'red' | 'purple' | 'muted';

interface BadgeProps {
  variant: BadgeVariant;
  dot?: boolean;
  children: React.ReactNode;
}

export default function Badge({ variant, dot, children }: BadgeProps) {
  return (
    <span className={`badge badge-${variant}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}
