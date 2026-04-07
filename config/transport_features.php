<?php

return [
    'security_headers' => (bool) env('TRANSPORT_FEATURE_SECURITY_HEADERS', true),
    'sensitive_audit' => (bool) env('TRANSPORT_FEATURE_SENSITIVE_AUDIT', true),
    'operations_hub' => (bool) env('TRANSPORT_FEATURE_OPERATIONS_HUB', true),
    'programming_panel' => (bool) env('TRANSPORT_FEATURE_PROGRAMMING_PANEL', true),
    'csv_exports' => (bool) env('TRANSPORT_FEATURE_CSV_EXPORTS', true),
    'collaborator_index_cache' => (bool) env('TRANSPORT_FEATURE_COLLAB_CACHE', true),
];
