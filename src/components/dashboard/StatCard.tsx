import { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface StatCardProps {
  title: string;
  value: number;
  description: string;
  icon?: LucideIcon;
  emptyStateText?: string;
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  emptyStateText,
}: StatCardProps) {
  const showEmptyState = value === 0 && emptyStateText;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {Icon && (
          <Icon className="h-4 w-4 text-muted-foreground" />
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <p className={showEmptyState ? "text-sm text-muted-foreground mt-1" : "text-xs text-muted-foreground mt-1"}>
          {showEmptyState ? emptyStateText : description}
        </p>
      </CardContent>
    </Card>
  );
}
