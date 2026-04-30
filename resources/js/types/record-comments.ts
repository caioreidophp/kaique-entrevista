export type RecordCommentModuleKey =
    | 'interviews'
    | 'onboarding'
    | 'payroll'
    | 'vacations'
    | 'freight'
    | 'fines'
    | 'programming'
    | 'registry'
    | 'operations';

export interface RecordCommentAuthor {
    id: number;
    name: string;
    email: string;
}

export interface RecordCommentEntry {
    id: number;
    module_key: RecordCommentModuleKey;
    record_id: number;
    body: string;
    mentioned_user_ids: number[];
    mentioned_users: RecordCommentAuthor[];
    created_at: string | null;
    updated_at: string | null;
    author: RecordCommentAuthor | null;
}

export interface RecordCommentListResponse {
    data: RecordCommentEntry[];
}

export interface RecordCommentStoreResponse {
    message: string;
    data: RecordCommentEntry;
}

export interface TransportGlobalSearchResult {
    id: string;
    type: string;
    module: string;
    title: string;
    subtitle: string;
    href: string;
    meta: Record<string, unknown>;
}

export interface TransportGlobalSearchResponse {
    query: string;
    data: TransportGlobalSearchResult[];
    total: number;
    took_ms: number;
}

export interface UserQuickAccessEntry {
    id: number;
    user_id: number;
    shortcut_key: string;
    label: string;
    href: string;
    icon: string | null;
    sort_order: number;
    is_active: boolean;
    created_at: string | null;
    updated_at: string | null;
}

export interface UserQuickAccessListResponse {
    data: UserQuickAccessEntry[];
}
