<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResponseCompression
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        $acceptEncoding = (string) $request->headers->get('Accept-Encoding', '');
        if (! str_contains(strtolower($acceptEncoding), 'gzip')) {
            return $response;
        }

        if ($response->headers->has('Content-Encoding')) {
            return $response;
        }

        $contentType = (string) $response->headers->get('Content-Type', '');
        if (! str_contains(strtolower($contentType), 'application/json')) {
            return $response;
        }

        $content = (string) $response->getContent();
        if ($content === '' || strlen($content) < 1024) {
            return $response;
        }

        if (! function_exists('gzencode')) {
            return $response;
        }

        $compressed = gzencode($content, 6);
        if ($compressed === false) {
            return $response;
        }

        $response->setContent($compressed);
        $response->headers->set('Content-Encoding', 'gzip');
        $response->headers->set('Vary', trim(((string) $response->headers->get('Vary', '')).' ,Accept-Encoding', ' ,'));
        $response->headers->set('Content-Length', (string) strlen($compressed));

        return $response;
    }
}
