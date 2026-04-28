<?php

namespace App\Support;

class AccessScopeCatalog
{
    /**
     * @return array<int, array{key:string,label:string}>
     */
    public static function modules(): array
    {
        return [
            ['key' => 'registry', 'label' => 'Cadastro'],
            ['key' => 'interviews', 'label' => 'Entrevistas'],
            ['key' => 'onboarding', 'label' => 'Onboarding'],
            ['key' => 'payroll', 'label' => 'Pagamentos'],
            ['key' => 'vacations', 'label' => 'Férias'],
            ['key' => 'freight', 'label' => 'Fretes'],
            ['key' => 'programming', 'label' => 'Programação'],
            ['key' => 'fines', 'label' => 'Multas'],
            ['key' => 'operations', 'label' => 'Operações'],
            ['key' => 'system', 'label' => 'Sistema'],
        ];
    }

    /**
     * @return array<int, string>
     */
    public static function moduleKeys(): array
    {
        return array_map(
            static fn (array $module): string => (string) $module['key'],
            self::modules(),
        );
    }

    /**
     * @return array<int, string>
     */
    public static function dataScopes(): array
    {
        return ['all', 'own', 'units'];
    }

    /**
     * @param  array<int, array<string, mixed>>  $scopes
     * @return array<int, array<string, mixed>>
     */
    public static function normalize(array $scopes): array
    {
        $allowedModules = self::moduleKeys();
        $allowedScopeTypes = self::dataScopes();

        return collect($scopes)
            ->map(function (array $scope) use ($allowedModules, $allowedScopeTypes): ?array {
                $moduleKey = trim((string) ($scope['module_key'] ?? ''));
                $dataScope = trim((string) ($scope['data_scope'] ?? 'all'));

                if (! in_array($moduleKey, $allowedModules, true)) {
                    return null;
                }

                if (! in_array($dataScope, $allowedScopeTypes, true)) {
                    $dataScope = 'all';
                }

                $allowedUnitIds = collect((array) ($scope['allowed_unit_ids'] ?? []))
                    ->map(fn ($unitId): int => (int) $unitId)
                    ->filter(fn (int $unitId): bool => $unitId > 0)
                    ->unique()
                    ->values()
                    ->all();

                return [
                    'module_key' => $moduleKey,
                    'data_scope' => $dataScope,
                    'allowed_unit_ids' => $dataScope === 'units' ? $allowedUnitIds : [],
                    'metadata' => is_array($scope['metadata'] ?? null) ? $scope['metadata'] : [],
                ];
            })
            ->filter()
            ->values()
            ->all();
    }
}
