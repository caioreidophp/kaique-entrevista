import type { AppLayoutProps } from '@/types';
import AppLayoutTemplate from '@/layouts/app/app-sidebar-layout';

export default ({ children, breadcrumbs, ...props }: AppLayoutProps) => (
    <AppLayoutTemplate breadcrumbs={breadcrumbs} {...props}>
        {children}
    </AppLayoutTemplate>
);
