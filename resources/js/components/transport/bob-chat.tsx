import { Bot, LoaderCircle, MessageCircle, Send, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiDelete, apiGet, apiPost } from '@/lib/api-client';

type BobMessage = {
    id: string;
    role: 'user' | 'bob';
    content: string;
    createdAt: number;
};

type BobHistoryResponse = {
    messages: Array<{
        id: string;
        role: 'user' | 'bob';
        content: string;
        created_at?: string | null;
    }>;
};

function buildWelcomeMessage(id = 'welcome'): BobMessage {
    return {
        id,
        role: 'bob',
        content:
            'Eu sou o Bob. Posso responder sobre fretes, pagamentos, férias e entrevistas, além de lançar frete por comando em texto.',
        createdAt: Date.now(),
    };
}

function parseIsoDateToMillis(value?: string | null): number {
    if (!value) {
        return Date.now();
    }

    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Date.now() : parsed;
}

export function BobChatButton() {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [clearingHistory, setClearingHistory] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const [messages, setMessages] = useState<BobMessage[]>([buildWelcomeMessage()]);

    const suggestions = useMemo(
        () => [
            'fretes do dia 01/03/2026',
            'resumo pagamentos março 2026',
            'quando vai vencer as ferias do adair',
            'resumo entrevistas',
        ],
        [],
    );

    const canClearChat = !loadingHistory && !clearingHistory && messages.length > 0;

    useEffect(() => {
        let active = true;

        async function loadHistory(): Promise<void> {
            setLoadingHistory(true);

            try {
                const response = await apiGet<BobHistoryResponse>('/bob/history');
                if (!active) return;

                if (response.messages.length === 0) {
                    setMessages([buildWelcomeMessage()]);
                    return;
                }

                setMessages(
                    response.messages.map((message) => ({
                        id: message.id,
                        role: message.role,
                        content: message.content,
                        createdAt: parseIsoDateToMillis(message.created_at),
                    })),
                );
            } catch {
                if (active) {
                    setMessages([buildWelcomeMessage('welcome-fallback')]);
                }
            } finally {
                if (active) {
                    setLoadingHistory(false);
                }
            }
        }

        void loadHistory();

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading, open]);

    useEffect(() => {
        if (open) {
            setUnreadCount(0);
        }
    }, [open]);

    function formatTime(timestamp: number): string {
        return new Intl.DateTimeFormat('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(timestamp));
    }

    async function clearChat(): Promise<void> {
        if (clearingHistory || loadingHistory) {
            return;
        }

        setClearingHistory(true);

        try {
            await apiDelete('/bob/history');
            setMessages([
                {
                    id: 'welcome-reset',
                    role: 'bob',
                    content: 'Conversa reiniciada. Posso consultar lançamentos e lançar fretes para você.',
                    createdAt: Date.now(),
                },
            ]);
        } finally {
            setClearingHistory(false);
        }
    }

    async function sendMessage(text: string): Promise<void> {
        const trimmed = text.trim();
        if (!trimmed || loading) return;

        const now = Date.now();

        setMessages((prev) => [
            ...prev,
            {
                id: `user-${now}`,
                role: 'user',
                content: trimmed,
                createdAt: now,
            },
        ]);
        setInput('');
        setLoading(true);

        try {
            const response = await apiPost<{ reply: string }>('/bob/chat', {
                message: trimmed,
            });

            const bobTime = Date.now();
            setMessages((prev) => [
                ...prev,
                {
                    id: `bob-${bobTime}`,
                    role: 'bob',
                    content: response.reply,
                    createdAt: bobTime,
                },
            ]);

            if (!open) {
                setUnreadCount((previous) => previous + 1);
            }
        } catch {
            const errorTime = Date.now();

            setMessages((prev) => [
                ...prev,
                {
                    id: `bob-error-${errorTime}`,
                    role: 'bob',
                    content:
                        'Não consegui processar agora. Tenta novamente com os dados em formato mais direto (data, unidade, frete, cargas, aves, km).',
                    createdAt: errorTime,
                },
            ]);

            if (!open) {
                setUnreadCount((previous) => previous + 1);
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed right-3 bottom-3 z-40 print:hidden">
            <div
                className={`absolute right-0 bottom-14 flex h-[min(74vh,620px)] w-[min(94vw,430px)] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl transition-all duration-200 ${
                    open ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
                }`}
            >
                <div className="flex items-center justify-between border-b bg-muted/20 px-3 py-2.5">
                    <div>
                        <p className="inline-flex items-center gap-2 text-sm font-semibold">
                            <span className="inline-flex size-6 items-center justify-center rounded-full border bg-background">
                                <Bot className="size-3.5" />
                            </span>
                            Bob
                            <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                <span className="size-1.5 rounded-full bg-emerald-500" />
                                online
                            </span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">Assistente operacional do sistema</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => void clearChat()}
                            disabled={!canClearChat}
                            title="Limpar conversa"
                        >
                            <Trash2 className="size-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)}>
                            <X className="size-4" />
                        </Button>
                    </div>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto bg-muted/[0.18] p-3">
                    {loadingHistory ? (
                        <div className="inline-flex items-center gap-2 rounded-lg border bg-background px-2 py-1 text-xs text-muted-foreground">
                            <LoaderCircle className="size-3.5 animate-spin" />
                            Carregando histórico da conversa...
                        </div>
                    ) : null}

                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`max-w-[90%] rounded-xl border px-3 py-2 text-sm whitespace-pre-wrap ${
                                message.role === 'user'
                                    ? 'ml-auto bg-primary text-primary-foreground'
                                    : 'mr-auto bg-background'
                            }`}
                        >
                            <div>{message.content}</div>
                            <p
                                className={`mt-1 text-[10px] ${
                                    message.role === 'user' ? 'text-primary-foreground/80' : 'text-muted-foreground'
                                }`}
                            >
                                {formatTime(message.createdAt)}
                            </p>
                        </div>
                    ))}

                    {loading ? (
                        <div className="inline-flex items-center gap-2 rounded-lg border bg-background px-2 py-1 text-xs text-muted-foreground">
                            <LoaderCircle className="size-3.5 animate-spin" />
                            Bob está analisando sua solicitação...
                        </div>
                    ) : null}

                    <div ref={messagesEndRef} />
                </div>

                <div className="border-t bg-card p-2.5">
                    <div className="mb-2 text-[10px] text-muted-foreground">Atalhos rápidos</div>

                    <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                        {suggestions.map((suggestion) => (
                            <Button
                                key={suggestion}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 shrink-0 rounded-full text-[11px]"
                                onClick={() => void sendMessage(suggestion)}
                            >
                                {suggestion}
                            </Button>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <Input
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            placeholder="Pergunte ou envie um comando para o Bob..."
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault();
                                    void sendMessage(input);
                                }
                            }}
                        />
                        <Button
                            type="button"
                            onClick={() => void sendMessage(input)}
                            disabled={loading || loadingHistory}
                            size="icon"
                            className="shrink-0"
                        >
                            <Send className="size-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <Button
                type="button"
                onClick={() => setOpen((previous) => !previous)}
                className="relative h-11 gap-2 rounded-2xl px-4 shadow-2xl"
            >
                <MessageCircle className="size-4" />
                Bob
                {unreadCount > 0 ? (
                    <span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full border bg-background px-1 text-[10px] text-foreground">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                ) : null}
            </Button>
        </div>
    );
}
