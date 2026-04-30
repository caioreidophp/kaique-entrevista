import { LoaderCircle, MessageSquareText, Send, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Notification } from '@/components/transport/notification';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError, apiDelete, apiGet, apiPost } from '@/lib/api-client';
import { getStoredUser } from '@/lib/transport-session';
import type {
    RecordCommentEntry,
    RecordCommentListResponse,
    RecordCommentModuleKey,
    RecordCommentStoreResponse,
} from '@/types/record-comments';

interface RecordCommentsPanelProps {
    moduleKey: RecordCommentModuleKey;
    recordId: number | null;
    title?: string;
}

function formatDate(value: string | null): string {
    if (!value) {
        return '-';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '-';
    }

    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(date);
}

function renderTextWithMentions(text: string): React.ReactNode {
    const parts = text.split(/(@[A-Za-z0-9._-]{2,120})/g);

    return parts.map((part, index) => {
        if (part.startsWith('@') && part.length > 1) {
            return (
                <span key={`${part}-${index}`} className="font-medium text-primary">
                    {part}
                </span>
            );
        }

        return <span key={`${part}-${index}`}>{part}</span>;
    });
}

export function RecordCommentsPanel({
    moduleKey,
    recordId,
    title = 'Comentários',
}: RecordCommentsPanelProps) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [items, setItems] = useState<RecordCommentEntry[]>([]);
    const [body, setBody] = useState('');
    const [notice, setNotice] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);
    const currentUser = getStoredUser();

    const canSend = useMemo(() => {
        return recordId !== null && body.trim().length >= 2 && !saving;
    }, [body, recordId, saving]);

    async function loadComments(targetRecordId: number): Promise<void> {
        setLoading(true);

        try {
            const response = await apiGet<RecordCommentListResponse>(
                `/record-comments?module_key=${encodeURIComponent(moduleKey)}&record_id=${targetRecordId}&limit=80`,
            );

            setItems(response.data);
        } catch (error) {
            if (error instanceof ApiError) {
                setNotice({ message: error.message, variant: 'error' });
            } else {
                setNotice({
                    message: 'Não foi possível carregar os comentários.',
                    variant: 'error',
                });
            }
        } finally {
            setLoading(false);
        }
    }

    async function handleSend(): Promise<void> {
        if (!recordId || !canSend) {
            return;
        }

        setSaving(true);
        setNotice(null);

        try {
            const response = await apiPost<RecordCommentStoreResponse>('/record-comments', {
                module_key: moduleKey,
                record_id: recordId,
                body: body.trim(),
            });

            setItems((previous) => [response.data, ...previous]);
            setBody('');
            setNotice({
                message: response.message,
                variant: 'success',
            });
        } catch (error) {
            if (error instanceof ApiError) {
                setNotice({ message: error.message, variant: 'error' });
            } else {
                setNotice({
                    message: 'Não foi possível salvar o comentário.',
                    variant: 'error',
                });
            }
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(comment: RecordCommentEntry): Promise<void> {
        try {
            await apiDelete(`/record-comments/${comment.id}`);
            setItems((previous) => previous.filter((item) => item.id !== comment.id));
            setNotice({
                message: 'Comentário removido com sucesso.',
                variant: 'success',
            });
        } catch (error) {
            if (error instanceof ApiError) {
                setNotice({ message: error.message, variant: 'error' });
            } else {
                setNotice({
                    message: 'Não foi possível remover o comentário.',
                    variant: 'error',
                });
            }
        }
    }

    useEffect(() => {
        if (!recordId) {
            setItems([]);
            return;
        }

        void loadComments(recordId);
    }, [moduleKey, recordId]);

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquareText className="size-4" />
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {notice ? (
                    <Notification message={notice.message} variant={notice.variant} />
                ) : null}

                {recordId ? (
                    <div className="space-y-2">
                        <label
                            htmlFor={`record-comment-${moduleKey}-${recordId}`}
                            className="text-xs font-medium text-muted-foreground uppercase"
                        >
                            Novo comentário
                        </label>
                        <textarea
                            id={`record-comment-${moduleKey}-${recordId}`}
                            value={body}
                            onChange={(event) => setBody(event.target.value)}
                            rows={3}
                            placeholder="Use @nome ou @email para mencionar alguém."
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary/30"
                        />
                        <div className="flex justify-end">
                            <Button type="button" onClick={() => void handleSend()} disabled={!canSend}>
                                {saving ? (
                                    <>
                                        <LoaderCircle className="size-4 animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    <>
                                        <Send className="size-4" />
                                        Publicar
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        Selecione um registro para visualizar e publicar comentários.
                    </p>
                )}

                <div className="space-y-3">
                    {loading ? (
                        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <LoaderCircle className="size-4 animate-spin" />
                            Carregando comentários...
                        </p>
                    ) : items.length === 0 ? (
                        <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                            Ainda não há comentários neste registro.
                        </p>
                    ) : (
                        items.map((comment) => {
                            const canDelete =
                                currentUser?.role === 'master_admin' ||
                                currentUser?.id === comment.author?.id;

                            return (
                                <article
                                    key={comment.id}
                                    className="rounded-md border bg-muted/20 px-3 py-2"
                                >
                                    <div className="mb-2 flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium">
                                                {comment.author?.name ?? 'Usuário removido'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatDate(comment.created_at)}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {comment.mentioned_users.length > 0 ? (
                                                <Badge variant="secondary">
                                                    {comment.mentioned_users.length} menção(ões)
                                                </Badge>
                                            ) : null}
                                            {canDelete ? (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => void handleDelete(comment)}
                                                    className="size-7"
                                                    title="Remover comentário"
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            ) : null}
                                        </div>
                                    </div>

                                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                        {renderTextWithMentions(comment.body)}
                                    </p>
                                </article>
                            );
                        })
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
