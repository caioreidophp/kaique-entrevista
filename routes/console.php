<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('transport:cleanup-simulation {--dry-run : Apenas exibe os totais sem remover registros}', function () {
    $dryRun = (bool) $this->option('dry-run');
    $resolveTable = static fn (array $candidates): ?string => collect($candidates)
        ->first(static fn (string $table): bool => Schema::hasTable($table));

    $discountTable = $resolveTable(['descontos_colaboradores', 'desconto_colaboradores']);
    $loanTable = $resolveTable(['emprestimos_colaboradores', 'emprestimo_colaboradores']);
    $pensionTable = $resolveTable(['pensoes_colaboradores', 'pensao_colaboradores']);

    if (! Schema::hasTable('unidades') || ! Schema::hasTable('colaboradores')) {
        $this->error('Tabelas base de cadastro não encontradas. Operação cancelada.');

        return 1;
    }

    $unitColumns = Schema::getColumnListing('unidades');
    $hasUnitSlug = in_array('slug', $unitColumns, true);
    $hasUnitName = in_array('nome', $unitColumns, true);
    $hasUnitCode = in_array('codigo', $unitColumns, true);

    $simulationUnitIds = DB::table('unidades')
        ->where(function ($query) use ($hasUnitCode, $hasUnitName, $hasUnitSlug): void {
            $hasCondition = false;

            if ($hasUnitSlug) {
                $query->whereRaw('LOWER(COALESCE(slug, "")) like ?', ['sim%']);
                $hasCondition = true;
            }

            if ($hasUnitName) {
                if ($hasCondition) {
                    $query->orWhereRaw('LOWER(COALESCE(nome, "")) like ?', ['%simula%']);
                } else {
                    $query->whereRaw('LOWER(COALESCE(nome, "")) like ?', ['%simula%']);
                    $hasCondition = true;
                }
            }

            if ($hasUnitCode) {
                if ($hasCondition) {
                    $query->orWhereRaw('LOWER(COALESCE(codigo, "")) like ?', ['sim%']);
                } else {
                    $query->whereRaw('LOWER(COALESCE(codigo, "")) like ?', ['sim%']);
                }
            }
        })
        ->pluck('id')
        ->all();

    $collaboratorColumns = Schema::getColumnListing('colaboradores');
    $hasCollaboratorName = in_array('nome', $collaboratorColumns, true);
    $hasCollaboratorRegistration = in_array('matricula', $collaboratorColumns, true);
    $hasCollaboratorCpf = in_array('cpf', $collaboratorColumns, true);

    $simulationCollaboratorIds = DB::table('colaboradores')
        ->where(function ($query) use ($hasCollaboratorCpf, $hasCollaboratorName, $hasCollaboratorRegistration, $simulationUnitIds): void {
            $hasCondition = false;

            if ($simulationUnitIds !== []) {
                $query->whereIn('unidade_id', $simulationUnitIds);
                $hasCondition = true;
            }

            if ($hasCollaboratorName) {
                if ($hasCondition) {
                    $query->orWhereRaw('LOWER(COALESCE(nome, "")) like ?', ['%simula%']);
                } else {
                    $query->whereRaw('LOWER(COALESCE(nome, "")) like ?', ['%simula%']);
                    $hasCondition = true;
                }
            }

            if ($hasCollaboratorRegistration) {
                if ($hasCondition) {
                    $query->orWhereRaw('LOWER(COALESCE(matricula, "")) like ?', ['sim%']);
                } else {
                    $query->whereRaw('LOWER(COALESCE(matricula, "")) like ?', ['sim%']);
                    $hasCondition = true;
                }
            }

            if ($hasCollaboratorCpf) {
                if ($hasCondition) {
                    $query->orWhereRaw('LOWER(COALESCE(cpf, "")) like ?', ['%999999999%']);
                } else {
                    $query->whereRaw('LOWER(COALESCE(cpf, "")) like ?', ['%999999999%']);
                }
            }
        })
        ->pluck('id')
        ->all();

    $orphanDiscountCount = $discountTable
        ? DB::table("{$discountTable} as dc")
            ->leftJoin('colaboradores as c', 'c.id', '=', 'dc.colaborador_id')
            ->whereNull('c.id')
            ->count()
        : 0;

    $summary = [
        'unidades_simulacao' => count($simulationUnitIds),
        'colaboradores_simulacao' => count($simulationCollaboratorIds),
        'descontos_orfaos' => $orphanDiscountCount,
    ];

    $this->table(['Item', 'Total'], collect($summary)->map(fn ($value, $key) => [$key, $value])->all());

    if ($dryRun) {
        $this->info('Dry-run concluído. Nenhum registro foi removido.');

        return 0;
    }

    DB::transaction(function () use ($discountTable, $loanTable, $pensionTable, $simulationCollaboratorIds, $simulationUnitIds): void {
        if ($discountTable) {
            DB::table($discountTable)
                ->when($simulationCollaboratorIds !== [], fn ($query) => $query->whereIn('colaborador_id', $simulationCollaboratorIds))
                ->orWhereNotExists(function ($query) use ($discountTable): void {
                    $query->select(DB::raw(1))
                        ->from('colaboradores')
                        ->whereColumn('colaboradores.id', "{$discountTable}.colaborador_id");
                })
                ->delete();
        }

        if ($loanTable && $simulationCollaboratorIds !== []) {
            DB::table($loanTable)->whereIn('colaborador_id', $simulationCollaboratorIds)->delete();
        }

        if ($pensionTable && $simulationCollaboratorIds !== []) {
            DB::table($pensionTable)->whereIn('colaborador_id', $simulationCollaboratorIds)->delete();
        }

        if (Schema::hasTable('pagamentos') && $simulationCollaboratorIds !== []) {
            DB::table('pagamentos')->whereIn('colaborador_id', $simulationCollaboratorIds)->delete();
        }

        if (Schema::hasTable('ferias_lancamentos') && $simulationCollaboratorIds !== []) {
            DB::table('ferias_lancamentos')->whereIn('colaborador_id', $simulationCollaboratorIds)->delete();
        }

        if ($simulationCollaboratorIds !== []) {
            DB::table('colaboradores')->whereIn('id', $simulationCollaboratorIds)->delete();
        }

        if ($simulationUnitIds !== []) {
            DB::table('unidades')->whereIn('id', $simulationUnitIds)->delete();
        }
    });

    $this->info('Limpeza concluída com sucesso.');

    return 0;
})->purpose('Remove dados de simulação e descontos órfãos do ambiente de transporte');
