<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Colaborador;
use App\Models\DriverInterview;
use App\Models\FeriasLancamento;
use App\Models\FreightCanceledLoad;
use App\Models\Multa;
use App\Models\OperationalTask;
use App\Models\Pagamento;
use App\Models\ProgramacaoViagem;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GlobalSearchController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $startedAt = microtime(true);
        $term = trim((string) $request->string('q'));
        $limit = max(6, min(60, (int) $request->integer('limit', 24)));
        $perType = max(2, min(10, (int) ceil($limit / 6)));

        if (mb_strlen($term) < 2) {
            return response()->json([
                'query' => $term,
                'data' => [],
                'total' => 0,
                'took_ms' => 0,
            ]);
        }

        /** @var User $user */
        $user = $request->user();
        $results = [];

        if ($this->canSearchRegistry($user)) {
            $results = array_merge($results, $this->searchCollaborators($user, $term, $perType));
        }

        if ($this->canSearchInterviews($user)) {
            $results = array_merge($results, $this->searchInterviews($user, $term, $perType));
        }

        if ($this->canSearchPayroll($user)) {
            $results = array_merge($results, $this->searchPayroll($user, $term, $perType));
        }

        if ($this->canSearchVacations($user)) {
            $results = array_merge($results, $this->searchVacations($user, $term, $perType));
        }

        if ($this->canSearchFreight($user)) {
            $results = array_merge($results, $this->searchFreight($user, $term, $perType));
        }

        if ($this->canSearchFines($user)) {
            $results = array_merge($results, $this->searchFines($user, $term, $perType));
        }

        if ($this->canSearchProgramming($user)) {
            $results = array_merge($results, $this->searchProgramming($user, $term, $perType));
        }

        if ($user->hasPermission('operations.tasks.view')) {
            $results = array_merge($results, $this->searchOperationalTasks($user, $term, $perType));
        }

        $results = array_values(array_slice($results, 0, $limit));

        return response()->json([
            'query' => $term,
            'data' => $results,
            'total' => count($results),
            'took_ms' => (int) round((microtime(true) - $startedAt) * 1000),
        ]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function searchCollaborators(User $user, string $term, int $limit): array
    {
        $query = Colaborador::query()
            ->with('unidade:id,nome')
            ->where(function (Builder $builder) use ($term): void {
                $builder->where('nome', 'like', "%{$term}%")
                    ->orWhere('email', 'like', "%{$term}%")
                    ->orWhere('telefone', 'like', "%{$term}%");
            });

        $unitScope = $this->visibleUnitIds($user, 'registry');
        if ($unitScope !== null) {
            $query->whereIn('unidade_id', $unitScope);
        }

        return $query
            ->orderBy('nome')
            ->limit($limit)
            ->get(['id', 'nome', 'unidade_id', 'email'])
            ->map(fn (Colaborador $row): array => [
                'id' => "collaborator:{$row->id}",
                'type' => 'collaborator',
                'module' => 'registry',
                'title' => (string) $row->nome,
                'subtitle' => 'Colaborador • '.($row->unidade?->nome ?? 'Sem unidade'),
                'href' => '/transport/registry/collaborators?search='.rawurlencode($term),
                'meta' => [
                    'record_id' => (int) $row->id,
                    'email' => (string) ($row->email ?? ''),
                ],
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function searchInterviews(User $user, string $term, int $limit): array
    {
        $query = DriverInterview::query()
            ->where(function (Builder $builder) use ($term): void {
                $builder->where('full_name', 'like', "%{$term}%")
                    ->orWhere('preferred_name', 'like', "%{$term}%")
                    ->orWhere('city', 'like', "%{$term}%");
            });

        if (! $user->isMasterAdmin() && ! $user->hasPermission('visibility.interviews.other-authors')) {
            $query->where('author_id', (int) $user->id);
        }

        return $query
            ->latest('id')
            ->limit($limit)
            ->get(['id', 'full_name', 'city', 'hr_status'])
            ->map(function (DriverInterview $row): array {
                $status = $row->hr_status;
                $statusValue = $status instanceof \BackedEnum ? (string) $status->value : (string) ($status ?? '');

                return [
                    'id' => "interview:{$row->id}",
                    'type' => 'interview',
                    'module' => 'interviews',
                    'title' => (string) $row->full_name,
                    'subtitle' => 'Entrevista • '.((string) ($row->city ?? 'Sem cidade')),
                    'href' => '/transport/interviews',
                    'meta' => [
                        'record_id' => (int) $row->id,
                        'status' => $statusValue,
                    ],
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function searchPayroll(User $user, string $term, int $limit): array
    {
        $query = Pagamento::query()
            ->with(['colaborador:id,nome', 'unidade:id,nome'])
            ->whereHas('colaborador', function (Builder $builder) use ($term): void {
                $builder->where('nome', 'like', "%{$term}%");
            });

        if (! $user->isMasterAdmin() && ! $user->hasPermission('visibility.payroll.other-authors')) {
            $query->where('autor_id', (int) $user->id);
        }

        $unitScope = $this->visibleUnitIds($user, 'payroll');
        if ($unitScope !== null) {
            $query->whereIn('unidade_id', $unitScope);
        }

        return $query
            ->latest('id')
            ->limit($limit)
            ->get(['id', 'colaborador_id', 'unidade_id', 'valor', 'competencia_mes', 'competencia_ano'])
            ->map(fn (Pagamento $row): array => [
                'id' => "payroll:{$row->id}",
                'type' => 'payroll',
                'module' => 'payroll',
                'title' => (string) ($row->colaborador?->nome ?? 'Colaborador'),
                'subtitle' => 'Folha • '.($row->unidade?->nome ?? 'Sem unidade'),
                'href' => '/transport/payroll/list?search='.rawurlencode($term),
                'meta' => [
                    'record_id' => (int) $row->id,
                    'valor' => (float) $row->valor,
                    'competencia' => sprintf('%02d/%04d', (int) $row->competencia_mes, (int) $row->competencia_ano),
                ],
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function searchVacations(User $user, string $term, int $limit): array
    {
        $query = FeriasLancamento::query()
            ->with(['colaborador:id,nome', 'unidade:id,nome'])
            ->whereHas('colaborador', function (Builder $builder) use ($term): void {
                $builder->where('nome', 'like', "%{$term}%");
            });

        if (! $user->isMasterAdmin()) {
            $query->where('autor_id', (int) $user->id);
        }

        $unitScope = $this->visibleUnitIds($user, 'vacations');
        if ($unitScope !== null) {
            $query->whereIn('unidade_id', $unitScope);
        }

        return $query
            ->latest('id')
            ->limit($limit)
            ->get(['id', 'colaborador_id', 'unidade_id', 'data_inicio', 'data_fim', 'tipo'])
            ->map(fn (FeriasLancamento $row): array => [
                'id' => "vacation:{$row->id}",
                'type' => 'vacation',
                'module' => 'vacations',
                'title' => (string) ($row->colaborador?->nome ?? 'Colaborador'),
                'subtitle' => 'Férias • '.($row->unidade?->nome ?? 'Sem unidade'),
                'href' => '/transport/vacations/list?search='.rawurlencode($term),
                'meta' => [
                    'record_id' => (int) $row->id,
                    'periodo' => trim(($row->data_inicio?->format('d/m/Y') ?? '').' - '.($row->data_fim?->format('d/m/Y') ?? '')),
                    'tipo' => (string) ($row->tipo ?? ''),
                ],
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function searchFreight(User $user, string $term, int $limit): array
    {
        $query = FreightCanceledLoad::query()
            ->with('unidade:id,nome')
            ->where(function (Builder $builder) use ($term): void {
                $builder->where('placa', 'like', "%{$term}%")
                    ->orWhere('n_viagem', 'like', "%{$term}%")
                    ->orWhere('aviario', 'like', "%{$term}%");
            });

        if (! $user->isMasterAdmin() && ! $user->hasPermission('visibility.freight.other-authors')) {
            $query->where('autor_id', (int) $user->id);
        }

        $unitScope = $this->visibleUnitIds($user, 'freight');
        if ($unitScope !== null) {
            $query->whereIn('unidade_id', $unitScope);
        }

        return $query
            ->latest('id')
            ->limit($limit)
            ->get(['id', 'unidade_id', 'placa', 'n_viagem', 'status', 'valor'])
            ->map(fn (FreightCanceledLoad $row): array => [
                'id' => "freight:{$row->id}",
                'type' => 'freight',
                'module' => 'freight',
                'title' => 'Carga cancelada #'.(int) $row->id,
                'subtitle' => 'Frete • '.($row->placa ?: 'Sem placa').' • '.($row->unidade?->nome ?? 'Sem unidade'),
                'href' => '/transport/freight/canceled-loads?search='.rawurlencode($term),
                'meta' => [
                    'record_id' => (int) $row->id,
                    'status' => (string) ($row->status ?? ''),
                    'viagem' => (string) ($row->n_viagem ?? ''),
                ],
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function searchFines(User $user, string $term, int $limit): array
    {
        $query = Multa::query()
            ->with(['placaFrota:id,placa', 'unidade:id,nome'])
            ->where(function (Builder $builder) use ($term): void {
                $builder->where('numero_auto_infracao', 'like', "%{$term}%")
                    ->orWhere('descricao', 'like', "%{$term}%")
                    ->orWhereHas('placaFrota', function (Builder $placaQuery) use ($term): void {
                        $placaQuery->where('placa', 'like', "%{$term}%");
                    });
            });

        if (! $user->isMasterAdmin()) {
            $query->where('autor_id', (int) $user->id);
        }

        $unitScope = $this->visibleUnitIds($user, 'fines');
        if ($unitScope !== null) {
            $query->whereIn('unidade_id', $unitScope);
        }

        return $query
            ->latest('id')
            ->limit($limit)
            ->get(['id', 'unidade_id', 'placa_frota_id', 'numero_auto_infracao', 'status', 'valor'])
            ->map(fn (Multa $row): array => [
                'id' => "fine:{$row->id}",
                'type' => 'fine',
                'module' => 'fines',
                'title' => 'Multa #'.(int) $row->id,
                'subtitle' => 'Multas • '.($row->placaFrota?->placa ?? 'Sem placa').' • '.($row->unidade?->nome ?? 'Sem unidade'),
                'href' => '/transport/fines/list?search='.rawurlencode($term),
                'meta' => [
                    'record_id' => (int) $row->id,
                    'status' => (string) ($row->status ?? ''),
                    'valor' => (float) $row->valor,
                ],
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function searchProgramming(User $user, string $term, int $limit): array
    {
        $query = ProgramacaoViagem::query()
            ->with('unidade:id,nome')
            ->where(function (Builder $builder) use ($term): void {
                $builder->where('codigo_viagem', 'like', "%{$term}%")
                    ->orWhere('origem', 'like', "%{$term}%")
                    ->orWhere('destino', 'like', "%{$term}%")
                    ->orWhere('aviario', 'like', "%{$term}%")
                    ->orWhere('cidade', 'like', "%{$term}%");
            });

        if (! $user->isMasterAdmin()) {
            $query->where('autor_id', (int) $user->id);
        }

        $unitScope = $this->visibleUnitIds($user, 'programming');
        if ($unitScope !== null) {
            $query->whereIn('unidade_id', $unitScope);
        }

        return $query
            ->latest('id')
            ->limit($limit)
            ->get(['id', 'unidade_id', 'codigo_viagem', 'data_viagem', 'origem', 'destino'])
            ->map(fn (ProgramacaoViagem $row): array => [
                'id' => "programming:{$row->id}",
                'type' => 'programming',
                'module' => 'programming',
                'title' => (string) ($row->codigo_viagem ?: 'Viagem #'.$row->id),
                'subtitle' => 'Programação • '.($row->unidade?->nome ?? 'Sem unidade'),
                'href' => '/transport/programming/dashboard?search='.rawurlencode($term),
                'meta' => [
                    'record_id' => (int) $row->id,
                    'data_viagem' => $row->data_viagem?->format('Y-m-d'),
                ],
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function searchOperationalTasks(User $user, string $term, int $limit): array
    {
        $query = OperationalTask::query()
            ->with('unidade:id,nome')
            ->where(function (Builder $builder) use ($term): void {
                $builder->where('title', 'like', "%{$term}%")
                    ->orWhere('description', 'like', "%{$term}%");
            });

        if (! $user->isMasterAdmin()) {
            $scope = $user->dataScopeFor('operations');

            if ($scope === 'units') {
                $allowed = $user->allowedUnitIdsFor('operations');
                if ($allowed === []) {
                    return [];
                }
                $query->whereIn('unidade_id', $allowed);
            }

            if ($scope === 'own') {
                $query->where(function (Builder $builder) use ($user): void {
                    $builder->where('created_by', (int) $user->id)
                        ->orWhere('assigned_to', (int) $user->id);
                });
            }
        }

        return $query
            ->latest('id')
            ->limit($limit)
            ->get(['id', 'unidade_id', 'title', 'status', 'priority'])
            ->map(fn (OperationalTask $row): array => [
                'id' => "task:{$row->id}",
                'type' => 'task',
                'module' => 'operations',
                'title' => (string) $row->title,
                'subtitle' => 'Pendências • '.($row->unidade?->nome ?? 'Sem unidade'),
                'href' => '/transport/pendencias?search='.rawurlencode($term),
                'meta' => [
                    'record_id' => (int) $row->id,
                    'status' => (string) $row->status,
                    'priority' => (string) $row->priority,
                ],
            ])
            ->values()
            ->all();
    }

    private function canSearchRegistry(User $user): bool
    {
        return $user->hasPermission('sidebar.registry.collaborators.view')
            || $user->hasPermission('registry.collaborators.list');
    }

    private function canSearchInterviews(User $user): bool
    {
        return $user->hasPermission('sidebar.interviews.view')
            || $user->hasPermission('interviews.list');
    }

    private function canSearchPayroll(User $user): bool
    {
        return $user->hasPermission('sidebar.payroll.list.view')
            || $user->hasPermission('payroll.dashboard.view');
    }

    private function canSearchVacations(User $user): bool
    {
        return $user->hasPermission('sidebar.vacations.list.view')
            || $user->hasPermission('vacations.dashboard.view');
    }

    private function canSearchFreight(User $user): bool
    {
        return $user->hasPermission('sidebar.freight.canceled-loads.view')
            || $user->hasPermission('freight.analytics.view')
            || $user->hasPermission('freight.dashboard.view');
    }

    private function canSearchFines(User $user): bool
    {
        return $user->hasPermission('sidebar.fines.list.view')
            || $user->hasPermission('fines.list.view');
    }

    private function canSearchProgramming(User $user): bool
    {
        return $user->hasPermission('sidebar.programming.dashboard.view');
    }

    /**
     * @return array<int, int>|null
     */
    private function visibleUnitIds(User $user, string $moduleKey): ?array
    {
        if ($user->isMasterAdmin() || $user->dataScopeFor($moduleKey) !== 'units') {
            return null;
        }

        return $user->allowedUnitIdsFor($moduleKey);
    }
}
