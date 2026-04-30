import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '../css/app.css';
import { initializeTheme } from './hooks/use-appearance';

const appName = 'Kaique';

interface AppErrorBoundaryProps {
    children: ReactNode;
}

interface AppErrorBoundaryState {
    hasError: boolean;
}

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
    state: AppErrorBoundaryState = {
        hasError: false,
    };

    static getDerivedStateFromError(): AppErrorBoundaryState {
        return {
            hasError: true,
        };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error('transport-app-runtime-error', error, info);
    }

    handleReload = (): void => {
        window.location.reload();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen items-center justify-center bg-muted/10 px-4">
                    <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-sm">
                        <h1 className="text-xl font-semibold">Falha ao carregar o painel</h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Ocorreu um erro inesperado. Atualize a pagina para recarregar o sistema.
                        </p>
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                                onClick={this.handleReload}
                            >
                                Recarregar
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

let hasReloadedForChunkFailure = false;

if (typeof window !== 'undefined') {
    window.addEventListener('vite:preloadError', (event) => {
        event.preventDefault();
        if (hasReloadedForChunkFailure) {
            return;
        }

        hasReloadedForChunkFailure = true;
        window.location.reload();
    });

    window.addEventListener('error', (event) => {
        const message = String(event?.message ?? '');
        if (
            !hasReloadedForChunkFailure &&
            /Failed to fetch dynamically imported module/i.test(message)
        ) {
            hasReloadedForChunkFailure = true;
            window.location.reload();
        }
    });
}

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) =>
        resolvePageComponent(
            `./pages/${name}.tsx`,
            import.meta.glob('./pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <AppErrorBoundary>
                <App {...props} />
            </AppErrorBoundary>,
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
