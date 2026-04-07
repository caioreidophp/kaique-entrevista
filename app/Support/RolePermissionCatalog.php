<?php

namespace App\Support;

use App\Models\RolePermission;
use Illuminate\Support\Facades\Cache;

class RolePermissionCatalog
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public static function sections(): array
    {
        return [
            [
                'key' => 'sidebar',
                'label' => 'Sidebar e Painéis',
                'groups' => [
                    [
                        'key' => 'sidebar.geral',
                        'label' => 'Acesso geral',
                        'items' => [
                            ['key' => 'sidebar.settings.view', 'label' => 'Configurações'],
                            ['key' => 'sidebar.activity-log.view', 'label' => 'Log de Atividades'],
                            ['key' => 'sidebar.operations-hub.view', 'label' => 'Pendências'],
                        ],
                    ],
                    [
                        'key' => 'sidebar.interviews',
                        'label' => 'Painel Entrevistas',
                        'items' => [
                            ['key' => 'sidebar.dashboard.view', 'label' => 'Dashboard entrevistas'],
                            ['key' => 'sidebar.interviews.view', 'label' => 'Lista de entrevistas'],
                            ['key' => 'sidebar.curriculums.view', 'label' => 'Currículos'],
                            ['key' => 'sidebar.interviews.create', 'label' => 'Nova entrevista'],
                            ['key' => 'sidebar.next-steps.view', 'label' => 'Próximos passos'],
                            ['key' => 'sidebar.onboarding.view', 'label' => 'Onboarding'],
                        ],
                    ],
                    [
                        'key' => 'sidebar.registry',
                        'label' => 'Painel Cadastro',
                        'items' => [
                            ['key' => 'sidebar.registry.collaborators.view', 'label' => 'Colaboradores'],
                            ['key' => 'sidebar.registry.users.view', 'label' => 'Usuários'],
                            ['key' => 'sidebar.registry.functions.view', 'label' => 'Funções'],
                            ['key' => 'sidebar.registry.payment-types.view', 'label' => 'Tipos de pagamento'],
                            ['key' => 'sidebar.registry.plates-aviaries.view', 'label' => 'Placas e aviários'],
                            ['key' => 'sidebar.registry.infractions.view', 'label' => 'Infrações'],
                        ],
                    ],
                    [
                        'key' => 'sidebar.payroll',
                        'label' => 'Painel Folha',
                        'items' => [
                            ['key' => 'sidebar.payroll.dashboard.view', 'label' => 'Dashboard folha'],
                            ['key' => 'sidebar.payroll.launch.view', 'label' => 'Lançar pagamentos'],
                            ['key' => 'sidebar.payroll.list.view', 'label' => 'Lista de pagamentos'],
                            ['key' => 'sidebar.payroll.adjustments.view', 'label' => 'Descontos/ajustes'],
                            ['key' => 'sidebar.payroll.report-unit.view', 'label' => 'Relatório por unidade'],
                            ['key' => 'sidebar.payroll.report-collaborator.view', 'label' => 'Relatório por colaborador'],
                        ],
                    ],
                    [
                        'key' => 'sidebar.vacations',
                        'label' => 'Painel Férias',
                        'items' => [
                            ['key' => 'sidebar.vacations.dashboard.view', 'label' => 'Dashboard férias'],
                            ['key' => 'sidebar.vacations.list.view', 'label' => 'Lista de férias'],
                            ['key' => 'sidebar.vacations.launch.view', 'label' => 'Lançar férias'],
                        ],
                    ],
                    [
                        'key' => 'sidebar.freight',
                        'label' => 'Painel Fretes',
                        'items' => [
                            ['key' => 'sidebar.freight.dashboard.view', 'label' => 'Dashboard fretes'],
                            ['key' => 'sidebar.freight.launch.view', 'label' => 'Lançar fretes'],
                            ['key' => 'sidebar.freight.list.view', 'label' => 'Lista de fretes'],
                            ['key' => 'sidebar.freight.spot.view', 'label' => 'Fretes spot'],
                            ['key' => 'sidebar.freight.canceled-loads.view', 'label' => 'Cargas canceladas'],
                            ['key' => 'sidebar.freight.timeline.view', 'label' => 'Central analítica'],
                        ],
                    ],
                    [
                        'key' => 'sidebar.fines',
                        'label' => 'Painel Gestão de Multas',
                        'items' => [
                            ['key' => 'sidebar.fines.dashboard.view', 'label' => 'Dashboard multas'],
                            ['key' => 'sidebar.fines.launch.view', 'label' => 'Lançar multas'],
                            ['key' => 'sidebar.fines.list.view', 'label' => 'Lista de multas'],
                        ],
                    ],
                    [
                        'key' => 'sidebar.programming',
                        'label' => 'Painel Programação',
                        'items' => [
                            ['key' => 'sidebar.programming.dashboard.view', 'label' => 'Programação de viagens'],
                        ],
                    ],
                ],
            ],
            [
                'key' => 'actions',
                'label' => 'Ações por módulo',
                'groups' => [
                    [
                        'key' => 'actions.interviews',
                        'label' => 'Entrevistas / Próximos passos / Onboarding',
                        'items' => [
                            ['key' => 'interviews.list', 'label' => 'Listar entrevistas'],
                            ['key' => 'interviews.create', 'label' => 'Criar entrevista'],
                            ['key' => 'interviews.update', 'label' => 'Editar entrevista'],
                            ['key' => 'interviews.delete', 'label' => 'Excluir entrevista'],
                            ['key' => 'interviews.pdf', 'label' => 'Gerar PDF da entrevista'],
                            ['key' => 'curriculums.list', 'label' => 'Listar currículos'],
                            ['key' => 'curriculums.create', 'label' => 'Cadastrar currículos'],
                            ['key' => 'curriculums.refuse', 'label' => 'Recusar currículos'],
                            ['key' => 'next-steps.list', 'label' => 'Listar próximos passos'],
                            ['key' => 'next-steps.mark-hired', 'label' => 'Marcar contratação'],
                            ['key' => 'onboarding.list', 'label' => 'Listar onboarding'],
                            ['key' => 'onboarding.update-item', 'label' => 'Atualizar item de onboarding'],
                            ['key' => 'onboarding.complete', 'label' => 'Concluir onboarding'],
                        ],
                    ],
                    [
                        'key' => 'actions.registry',
                        'label' => 'Cadastro',
                        'items' => [
                            ['key' => 'registry.collaborators.list', 'label' => 'Listar colaboradores'],
                            ['key' => 'registry.collaborators.create', 'label' => 'Criar colaborador'],
                            ['key' => 'registry.collaborators.update', 'label' => 'Editar colaborador'],
                            ['key' => 'registry.collaborators.delete', 'label' => 'Excluir colaborador'],
                            ['key' => 'registry.collaborators.import', 'label' => 'Importar colaboradores'],
                            ['key' => 'registry.collaborators.export', 'label' => 'Exportar colaboradores'],
                            ['key' => 'registry.users.manage', 'label' => 'Gerenciar usuários'],
                            ['key' => 'registry.functions.manage', 'label' => 'Gerenciar funções'],
                            ['key' => 'registry.payment-types.manage', 'label' => 'Gerenciar tipos de pagamento'],
                            ['key' => 'registry.plates-aviaries.manage', 'label' => 'Gerenciar placas/aviários'],
                            ['key' => 'registry.infractions.manage', 'label' => 'Gerenciar infrações de multa'],
                        ],
                    ],
                    [
                        'key' => 'actions.payroll',
                        'label' => 'Folha',
                        'items' => [
                            ['key' => 'payroll.dashboard.view', 'label' => 'Ver dashboard da folha'],
                            ['key' => 'payroll.launch-batch', 'label' => 'Lançar lote de pagamentos'],
                            ['key' => 'payroll.payments.edit', 'label' => 'Editar pagamentos'],
                            ['key' => 'payroll.payments.delete', 'label' => 'Excluir pagamentos'],
                            ['key' => 'payroll.adjustments.manage', 'label' => 'Gerenciar descontos/empréstimos/pensões'],
                            ['key' => 'payroll.reports.view', 'label' => 'Ver relatórios da folha'],
                        ],
                    ],
                    [
                        'key' => 'actions.vacations',
                        'label' => 'Férias',
                        'items' => [
                            ['key' => 'vacations.dashboard.view', 'label' => 'Ver dashboard férias'],
                            ['key' => 'vacations.launch', 'label' => 'Lançar férias'],
                            ['key' => 'vacations.edit', 'label' => 'Editar lançamento de férias'],
                            ['key' => 'vacations.history.view', 'label' => 'Ver histórico de férias'],
                        ],
                    ],
                    [
                        'key' => 'actions.freight',
                        'label' => 'Fretes',
                        'items' => [
                            ['key' => 'freight.dashboard.view', 'label' => 'Ver dashboard fretes'],
                            ['key' => 'freight.entries.create', 'label' => 'Criar lançamento de frete'],
                            ['key' => 'freight.entries.update', 'label' => 'Editar lançamento de frete'],
                            ['key' => 'freight.entries.delete', 'label' => 'Excluir lançamento de frete'],
                            ['key' => 'freight.entries.import', 'label' => 'Importar planilha de fretes'],
                            ['key' => 'freight.canceled-loads.manage', 'label' => 'Gerenciar cargas canceladas'],
                            ['key' => 'freight.analytics.view', 'label' => 'Ver central analítica'],
                        ],
                    ],
                    [
                        'key' => 'actions.programming',
                        'label' => 'Programação',
                        'items' => [
                            ['key' => 'programming.dashboard.view', 'label' => 'Ver painel de programação'],
                            ['key' => 'programming.import', 'label' => 'Importar base de programação'],
                            ['key' => 'programming.assign', 'label' => 'Escalar motorista e caminhão'],
                        ],
                    ],
                    [
                        'key' => 'actions.fines',
                        'label' => 'Gestão de Multas',
                        'items' => [
                            ['key' => 'fines.dashboard.view', 'label' => 'Ver dashboard de multas'],
                            ['key' => 'fines.list.view', 'label' => 'Ver lista de multas'],
                            ['key' => 'fines.entries.create', 'label' => 'Lançar multa'],
                            ['key' => 'fines.entries.update', 'label' => 'Editar multa'],
                            ['key' => 'fines.entries.delete', 'label' => 'Excluir multa'],
                            ['key' => 'fines.organs.manage', 'label' => 'Cadastrar órgão autuador'],
                        ],
                    ],
                    [
                        'key' => 'actions.sensitive',
                        'label' => 'Ações sensíveis',
                        'items' => [
                            ['key' => 'settings.password.update', 'label' => 'Alterar senha própria'],
                            ['key' => 'settings.backup.download', 'label' => 'Baixar backup do sistema'],
                            ['key' => 'activity-log.view', 'label' => 'Ver log de atividades'],
                        ],
                    ],
                ],
            ],
            [
                'key' => 'visibility',
                'label' => 'Visibilidade de informações',
                'groups' => [
                    [
                        'key' => 'visibility.interviews',
                        'label' => 'Entrevistas',
                        'items' => [
                            ['key' => 'visibility.interviews.other-authors', 'label' => 'Informações de entrevistas lançadas por outros usuários'],
                        ],
                    ],
                    [
                        'key' => 'visibility.payroll',
                        'label' => 'Folha',
                        'items' => [
                            ['key' => 'visibility.payroll.other-authors', 'label' => 'Informações de folha lançadas por outros usuários'],
                        ],
                    ],
                    [
                        'key' => 'visibility.freight',
                        'label' => 'Fretes',
                        'items' => [
                            ['key' => 'visibility.freight.other-authors', 'label' => 'Informações de fretes lançadas por outros usuários'],
                        ],
                    ],
                ],
            ],
        ];
    }

    /**
     * @return array<string, bool>
     */
    public static function defaultsForRole(string $role): array
    {
        $all = self::allPermissionKeys();

        if ($role === 'master_admin') {
            return collect($all)
                ->mapWithKeys(fn (string $key): array => [$key => true])
                ->all();
        }

        if ($role === 'usuario') {
            $allowed = [
                'sidebar.settings.view',
                'sidebar.dashboard.view',
                'sidebar.interviews.view',
                'sidebar.curriculums.view',
                'sidebar.interviews.create',
                'sidebar.next-steps.view',
                'sidebar.onboarding.view',
                'sidebar.registry.collaborators.view',
                'sidebar.registry.functions.view',
                'sidebar.registry.payment-types.view',
                'sidebar.registry.plates-aviaries.view',
                'sidebar.registry.infractions.view',
                'interviews.list',
                'interviews.create',
                'interviews.update',
                'interviews.delete',
                'interviews.pdf',
                'curriculums.list',
                'curriculums.create',
                'curriculums.refuse',
                'next-steps.list',
                'next-steps.mark-hired',
                'onboarding.list',
                'onboarding.update-item',
                'onboarding.complete',
                'registry.collaborators.list',
                'registry.collaborators.create',
                'registry.collaborators.update',
                'registry.collaborators.delete',
                'registry.collaborators.import',
                'registry.collaborators.export',
                'registry.functions.manage',
                'registry.payment-types.manage',
                'registry.plates-aviaries.manage',
                'registry.infractions.manage',
                'settings.password.update',
            ];

            return self::fromAllowedList($all, $allowed);
        }

        $deniedForAdmin = [
            'sidebar.activity-log.view',
            'registry.users.manage',
            'settings.backup.download',
            'activity-log.view',
            'visibility.interviews.other-authors',
            'visibility.payroll.other-authors',
            'visibility.freight.other-authors',
        ];

        return collect($all)
            ->mapWithKeys(fn (string $key): array => [$key => ! in_array($key, $deniedForAdmin, true)])
            ->all();
    }

    /**
     * @return array<string, bool>
     */
    public static function forRole(string $role): array
    {
        return Cache::remember(self::cacheKeyForRole($role), now()->addMinutes(10), function () use ($role): array {
            $defaults = self::defaultsForRole($role);
            $record = RolePermission::query()->where('role', $role)->first();

            if (! $record) {
                return $defaults;
            }

            $custom = is_array($record->permissions) ? $record->permissions : [];
            $all = self::allPermissionKeys();

            $final = [];

            foreach ($all as $key) {
                $value = $custom[$key] ?? $defaults[$key] ?? false;
                $final[$key] = (bool) $value;
            }

            return $final;
        });
    }

    /**
     * @param  array<string, bool|int|string>  $permissions
     */
    public static function saveForRole(string $role, array $permissions): array
    {
        $all = self::allPermissionKeys();
        $normalized = [];

        foreach ($all as $key) {
            $normalized[$key] = (bool) ($permissions[$key] ?? false);
        }

        RolePermission::query()->updateOrCreate(
            ['role' => $role],
            ['permissions' => $normalized],
        );

        Cache::forget(self::cacheKeyForRole($role));

        return self::forRole($role);
    }

    public static function isAllowed(?string $role, string $permissionKey): bool
    {
        if (! $role) {
            return false;
        }

        $permissions = self::forRole($role);

        return (bool) ($permissions[$permissionKey] ?? false);
    }

    /**
     * @return array<int, string>
     */
    public static function allPermissionKeys(): array
    {
        $keys = [];

        foreach (self::sections() as $section) {
            foreach (($section['groups'] ?? []) as $group) {
                foreach (($group['items'] ?? []) as $item) {
                    $key = (string) ($item['key'] ?? '');

                    if ($key !== '') {
                        $keys[] = $key;
                    }
                }
            }
        }

        return array_values(array_unique($keys));
    }

    /**
     * @param  array<int, string>  $all
     * @param  array<int, string>  $allowed
     * @return array<string, bool>
     */
    private static function fromAllowedList(array $all, array $allowed): array
    {
        return collect($all)
            ->mapWithKeys(fn (string $key): array => [$key => in_array($key, $allowed, true)])
            ->all();
    }

    private static function cacheKeyForRole(string $role): string
    {
        return 'transport:role-permissions:v1:'.$role;
    }
}
