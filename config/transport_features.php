<?php

return [
    'security_headers' => (bool) env('TRANSPORT_FEATURE_SECURITY_HEADERS', true),
    'sensitive_audit' => (bool) env('TRANSPORT_FEATURE_SENSITIVE_AUDIT', true),
    'security_incidents' => (bool) env('TRANSPORT_FEATURE_SECURITY_INCIDENTS', true),
    'operations_hub' => (bool) env('TRANSPORT_FEATURE_OPERATIONS_HUB', true),
    'programming_panel' => (bool) env('TRANSPORT_FEATURE_PROGRAMMING_PANEL', true),
    'csv_exports' => (bool) env('TRANSPORT_FEATURE_CSV_EXPORTS', true),
    'collaborator_index_cache' => (bool) env('TRANSPORT_FEATURE_COLLAB_CACHE', true),
    'session_management' => (bool) env('TRANSPORT_FEATURE_SESSION_MANAGEMENT', true),
    'openapi_docs' => (bool) env('TRANSPORT_FEATURE_OPENAPI_DOCS', true),
    'service_accounts' => (bool) env('TRANSPORT_FEATURE_SERVICE_ACCOUNTS', true),
    'outbound_webhooks' => (bool) env('TRANSPORT_FEATURE_OUTBOUND_WEBHOOKS', true),
    'backup_restore_assistant' => (bool) env('TRANSPORT_FEATURE_BACKUP_RESTORE_ASSISTANT', true),
    'financial_double_approval' => (bool) env('TRANSPORT_FEATURE_FINANCIAL_DOUBLE_APPROVAL', true),
    'financial_double_approval_threshold' => (float) env('TRANSPORT_FINANCIAL_DOUBLE_APPROVAL_THRESHOLD', 15000),
    'financial_double_approval_people_threshold' => (int) env('TRANSPORT_FINANCIAL_DOUBLE_APPROVAL_PEOPLE_THRESHOLD', 25),
    'financial_double_approval_token_ttl' => (int) env('TRANSPORT_FINANCIAL_DOUBLE_APPROVAL_TOKEN_TTL', 15),
];
