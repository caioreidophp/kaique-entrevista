import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type DashboardSegmentedOption<T extends string> = {
    value: T;
    label: string;
};

interface DashboardSegmentedControlProps<T extends string> {
    value: T;
    options: DashboardSegmentedOption<T>[];
    onChange: (value: T) => void;
}

export function DashboardSegmentedControl<T extends string>({
    value,
    options,
    onChange,
}: DashboardSegmentedControlProps<T>) {
    return (
        <div className="inline-flex rounded-md border border-border/80 bg-background p-0.5 shadow-sm">
            {options.map((option) => (
                <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={value === option.value ? 'default' : 'ghost'}
                    className="h-7 px-2.5 text-xs"
                    onClick={() => onChange(option.value)}
                >
                    {option.label}
                </Button>
            ))}
        </div>
    );
}

interface DashboardSectionProps {
    title: string;
    description?: string;
    children: ReactNode;
}

export function DashboardSection({
    title,
    description,
    children,
}: DashboardSectionProps) {
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{title}</h3>
                {description ? (
                    <p className="text-xs text-muted-foreground">
                        {description}
                    </p>
                ) : null}
            </div>
            {children}
        </div>
    );
}

interface DashboardInsightCardProps {
    label: string;
    value: string;
    detail: string;
    tone?: 'default' | 'attention' | 'positive';
}

export function DashboardInsightCard({
    label,
    value,
    detail,
    tone = 'default',
}: DashboardInsightCardProps) {
    const toneClass =
        tone === 'attention'
            ? 'border-amber-200 bg-amber-50/60'
            : tone === 'positive'
              ? 'border-emerald-200 bg-emerald-50/60'
              : 'border-border/80 bg-card';

    return (
        <Card className={`h-full ${toneClass}`}>
            <CardContent className="space-y-1.5 p-4">
                <p className="text-xs font-medium text-muted-foreground">
                    {label}
                </p>
                <p className="text-lg font-semibold leading-tight">{value}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                    {detail}
                </p>
            </CardContent>
        </Card>
    );
}

interface DashboardCompactCardProps {
    title: string;
    children: ReactNode;
}

export function DashboardCompactCard({
    title,
    children,
}: DashboardCompactCardProps) {
    return (
        <Card className="border-border/80">
            <CardHeader className="px-4 pt-3 pb-2">
                <CardTitle className="text-sm">{title}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">{children}</CardContent>
        </Card>
    );
}
