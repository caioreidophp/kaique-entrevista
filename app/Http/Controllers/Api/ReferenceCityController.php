<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class ReferenceCityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $cities = collect($this->allCities());
        $term = trim((string) $request->string('q'));

        if ($term !== '') {
            $normalizedTerm = $this->normalize($term);
            $cities = $cities->filter(
                fn (array $item): bool => str_contains((string) ($item['search'] ?? ''), $normalizedTerm)
            )->values();
        }

        return response()->json([
            'data' => $cities
                ->map(fn (array $item): array => [
                    'value' => (string) $item['value'],
                    'label' => (string) $item['label'],
                ])
                ->values(),
        ]);
    }

    /**
     * @return array<int, array{value:string,label:string,search:string}>
     */
    private function allCities(): array
    {
        /** @var array<int, array{value:string,label:string,search:string}> $cities */
        $cities = Cache::remember('reference:cities:br:v1', now()->addDays(30), function (): array {
            $response = Http::acceptJson()
                ->timeout(25)
                ->get('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome');

            if (! $response->ok()) {
                return [];
            }

            $payload = $response->json();

            if (! is_array($payload)) {
                return [];
            }

            return collect($payload)
                ->map(function ($item): ?array {
                    $city = trim((string) data_get($item, 'nome', ''));
                    $state = trim((string) data_get($item, 'microrregiao.mesorregiao.UF.sigla', ''));

                    if ($city === '' || $state === '') {
                        return null;
                    }

                    $label = sprintf('%s/%s', $city, $state);

                    return [
                        'value' => $label,
                        'label' => $label,
                        'search' => $this->normalize($label),
                    ];
                })
                ->filter()
                ->sortBy('label')
                ->values()
                ->all();
        });

        return $cities;
    }

    private function normalize(string $value): string
    {
        return Str::of($value)
            ->ascii()
            ->lower()
            ->toString();
    }
}
