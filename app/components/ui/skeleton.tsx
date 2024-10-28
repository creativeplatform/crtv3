import React from 'react';
import { cn } from '@app/lib/utils';

const Skeleton: React.FC<{
  width?: string;
  height?: string;
  className?: string;
}> = ({ width = '100%', height = '20px', className = '' }) => {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      style={{ width, height }}
    />
  );
};

export { Skeleton };
