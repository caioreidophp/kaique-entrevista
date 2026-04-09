<?php

namespace App\Support;

use Illuminate\Routing\Route as RoutingRoute;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

class OpenApiSpecBuilder
{
    public function build(): array
    {
        $paths = [];

        foreach (Route::getRoutes() as $route) {
            if (! $route instanceof RoutingRoute) {
                continue;
            }

            $uri = '/'.ltrim((string) $route->uri(), '/');

            if (! str_starts_with($uri, '/api/')) {
                continue;
            }

            $methods = array_values(array_diff($route->methods(), ['HEAD', 'OPTIONS']));
            if ($methods === []) {
                continue;
            }

            $tag = $this->inferTagFromUri($uri);
            $routeName = (string) ($route->getName() ?? '');
            $middleware = $route->gatherMiddleware();
            $secured = in_array('auth:sanctum', $middleware, true);

            foreach ($methods as $method) {
                $methodKey = strtolower((string) $method);
                $operationIdSource = $routeName !== ''
                    ? $routeName
                    : strtolower($method).'_'.str_replace('/', '_', trim($uri, '/'));

                $operationId = Str::of($operationIdSource)
                    ->replaceMatches('/[^A-Za-z0-9_]+/', '_')
                    ->trim('_')
                    ->value();

                $paths[$uri][$methodKey] = [
                    'tags' => [$tag],
                    'operationId' => $operationId,
                    'summary' => $this->buildSummary($routeName, $uri, $method),
                    'responses' => [
                        '200' => ['description' => 'Successful response'],
                        '401' => ['description' => 'Unauthenticated'],
                        '403' => ['description' => 'Forbidden'],
                        '422' => ['description' => 'Validation error'],
                    ],
                ];

                if ($secured) {
                    $paths[$uri][$methodKey]['security'] = [['bearerAuth' => []]];
                }
            }
        }

        ksort($paths);

        return [
            'openapi' => '3.1.0',
            'info' => [
                'title' => 'Kaique Transport API',
                'version' => '1.0.0',
                'description' => 'Especificacao OpenAPI gerada automaticamente a partir das rotas registradas.',
            ],
            'servers' => [
                [
                    'url' => url('/'),
                    'description' => 'Current environment',
                ],
            ],
            'components' => [
                'securitySchemes' => [
                    'bearerAuth' => [
                        'type' => 'http',
                        'scheme' => 'bearer',
                        'bearerFormat' => 'Token',
                    ],
                ],
            ],
            'paths' => $paths,
        ];
    }

    private function inferTagFromUri(string $uri): string
    {
        $segments = explode('/', trim($uri, '/'));
        $segment = $segments[1] ?? 'general';

        return Str::headline(str_replace('-', ' ', $segment));
    }

    private function buildSummary(string $routeName, string $uri, string $method): string
    {
        if ($routeName !== '') {
            return Str::headline(str_replace(['.', '-'], ' ', $routeName));
        }

        return Str::headline(strtolower($method).' '.str_replace(['/', '-'], ' ', trim($uri, '/')));
    }
}
