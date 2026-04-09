<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\OpenApiSpecBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;

class OpenApiController extends Controller
{
    public function json(Request $request, OpenApiSpecBuilder $builder): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        if (! (bool) config('transport_features.openapi_docs', true)) {
            abort(404);
        }

        $spec = Cache::remember('system:openapi:spec:v1', now()->addMinutes(5), fn (): array => $builder->build());

        return response()->json($spec);
    }

    public function view(Request $request): Response
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        if (! (bool) config('transport_features.openapi_docs', true)) {
            abort(404);
        }

        $jsonUrl = '/api/system/openapi.json';

        $html = <<<'HTML'
<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OpenAPI - Kaique Transport API</title>
    <style>
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
        .container { max-width: 1100px; margin: 0 auto; padding: 24px; }
        h1 { margin: 0 0 12px; font-size: 24px; }
        p { margin: 0 0 16px; color: #94a3b8; }
        a { color: #38bdf8; }
        pre { background: #020617; border: 1px solid #1e293b; border-radius: 10px; padding: 16px; overflow: auto; }
    </style>
</head>
<body>
<div class="container">
    <h1>OpenAPI - Kaique Transport API</h1>
    <p>Especificacao gerada automaticamente a partir das rotas atuais. JSON bruto: <a href="__JSON_URL__" target="_blank" rel="noopener">__JSON_URL__</a></p>
    <pre id="spec">Carregando especificacao...</pre>
</div>
<script>
(async function () {
    try {
        const response = await fetch('__JSON_URL__', { headers: { 'Accept': 'application/json' } });
        const data = await response.json();
        document.getElementById('spec').textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        document.getElementById('spec').textContent = 'Falha ao carregar especificacao: ' + (error?.message || error);
    }
})();
</script>
</body>
</html>
HTML;

        return response(
            str_replace('__JSON_URL__', $jsonUrl, $html),
            200,
            ['Content-Type' => 'text/html; charset=UTF-8'],
        );
    }
}
