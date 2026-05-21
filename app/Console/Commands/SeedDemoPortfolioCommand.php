<?php

namespace App\Console\Commands;

use App\Enums\CandidateInterest;
use App\Enums\GuepStatus;
use App\Enums\HrStatus;
use App\Enums\InterviewCurriculumStatus;
use App\Models\Colaborador;
use App\Models\DriverInterview;
use App\Models\FeriasLancamento;
use App\Models\FreightEntry;
use App\Models\Funcao;
use App\Models\InterviewCurriculum;
use App\Models\Multa;
use App\Models\MultaInfracao;
use App\Models\MultaOrgaoAutuador;
use App\Models\OperationalTask;
use App\Models\Pagamento;
use App\Models\PlacaFrota;
use App\Models\ProgramacaoEscala;
use App\Models\ProgramacaoViagem;
use App\Models\TipoPagamento;
use App\Models\Unidade;
use App\Models\UnitFleetSize;
use App\Models\User;
use App\Models\UserAccessScope;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class SeedDemoPortfolioCommand extends Command
{
    protected $signature = 'transport:seed-demo
        {--email=demo@kaiquetransportes.com.br : Demo login email}
        {--password=Demo@2026Kaique! : Demo login password}
        {--reset : Delete existing demo-owned records before seeding}';

    protected $description = 'Create an isolated read-only demo account with synthetic transport data.';

    /**
     * @var array<int, string>
     */
    private array $demoUnitSlugs = ['demo-amparo', 'demo-itapetininga'];

    public function handle(): int
    {
        $email = Str::lower(trim((string) $this->option('email')));
        $password = (string) $this->option('password');

        if ($email === '' || $password === '') {
            $this->error('Demo email and password cannot be empty.');

            return self::FAILURE;
        }

        DB::transaction(function () use ($email, $password): void {
            $user = $this->upsertDemoUser($email, $password);

            if ($this->option('reset')) {
                $this->deleteDemoData($user);
            }

            $units = $this->upsertDemoUnits();
            $this->upsertAccessScopes($user, $units);

            $function = $this->upsertFunction();
            $paymentType = $this->upsertPaymentType();
            $collaborators = $this->upsertCollaborators($user, $units, $function);

            $this->upsertCurriculumsAndInterviews($user, $units, $function);
            $this->upsertPayroll($user, $collaborators, $paymentType);
            $this->upsertVacations($user, $collaborators, $function);
            $this->upsertFreight($user, $units);
            $plates = $this->upsertFleetPlates($units);
            $this->upsertProgramming($user, $units, $collaborators, $plates);
            $this->upsertFines($user, $units, $collaborators, $plates);
            $this->upsertOperationalTasks($user, $units);
        });

        $this->info('Demo portfolio dataset is ready.');
        $this->line('Email: '.$email);
        $this->line('Set TRANSPORT_DEMO_EMAIL and VITE_TRANSPORT_DEMO_EMAIL to the same value.');
        $this->line('Set TRANSPORT_DEMO_READONLY=true before exposing the account publicly.');

        return self::SUCCESS;
    }

    private function upsertDemoUser(string $email, string $password): User
    {
        $user = User::query()->firstOrNew(['email' => $email]);
        $user->fill([
            'name' => 'Demo Reviewer',
            'email' => $email,
            'password' => Hash::make($password),
            'role' => 'admin',
        ]);

        if (Schema::hasColumn('users', 'email_verified_at') && ! $user->email_verified_at) {
            $user->email_verified_at = now();
        }

        $user->save();

        return $user;
    }

    /**
     * @return array<string, Unidade>
     */
    private function upsertDemoUnits(): array
    {
        $records = [
            'demo-amparo' => 'Demo Amparo',
            'demo-itapetininga' => 'Demo Itapetininga',
        ];

        $units = [];

        foreach ($records as $slug => $name) {
            $units[$slug] = Unidade::query()->updateOrCreate(
                ['slug' => $slug],
                ['nome' => $name, 'ativo' => true],
            );
        }

        return $units;
    }

    /**
     * @param  array<string, Unidade>  $units
     */
    private function upsertAccessScopes(User $user, array $units): void
    {
        $unitIds = collect($units)
            ->map(fn (Unidade $unit): int => (int) $unit->id)
            ->values()
            ->all();

        foreach (['registry', 'freight', 'payroll', 'vacations', 'fines', 'programming', 'operations'] as $moduleKey) {
            UserAccessScope::query()->updateOrCreate(
                [
                    'user_id' => $user->id,
                    'module_key' => $moduleKey,
                ],
                [
                    'data_scope' => 'units',
                    'allowed_unit_ids' => $unitIds,
                    'metadata' => ['demo' => true],
                ],
            );
        }
    }

    private function upsertFunction(): Funcao
    {
        return Funcao::query()->firstOrCreate(
            ['nome' => 'Motorista'],
            [
                'descricao' => 'Motorista operacional',
                'ativo' => true,
            ],
        );
    }

    private function upsertPaymentType(): TipoPagamento
    {
        return TipoPagamento::query()->firstOrCreate(
            ['nome' => 'Salário'],
            $this->onlyExistingColumns('tipos_pagamento', [
                'gera_encargos' => true,
                'categoria' => 'salario',
                'forma_pagamento' => 'transferencia',
            ]),
        );
    }

    /**
     * @param  array<string, Unidade>  $units
     * @return array<int, Colaborador>
     */
    private function upsertCollaborators(User $user, array $units, Funcao $function): array
    {
        $rows = [
            [
                'nome' => 'Demo Lucas Almeida',
                'apelido' => 'Lucas',
                'unit' => 'demo-amparo',
                'cpf' => '90000000001',
                'telefone' => '11990000001',
                'email' => 'lucas.demo@example.com',
                'data_admissao' => now()->subMonths(14)->toDateString(),
            ],
            [
                'nome' => 'Demo Marina Torres',
                'apelido' => 'Marina',
                'unit' => 'demo-itapetininga',
                'cpf' => '90000000002',
                'telefone' => '11990000002',
                'email' => 'marina.demo@example.com',
                'data_admissao' => now()->subMonths(9)->toDateString(),
            ],
            [
                'nome' => 'Demo Rafael Costa',
                'apelido' => 'Rafael',
                'unit' => 'demo-amparo',
                'cpf' => '90000000003',
                'telefone' => '11990000003',
                'email' => 'rafael.demo@example.com',
                'data_admissao' => now()->subMonths(5)->toDateString(),
            ],
        ];

        $collaborators = [];

        foreach ($rows as $row) {
            $collaboratorQuery = Colaborador::query();

            if (Schema::hasColumn('colaboradores', 'cpf_hash')) {
                $collaboratorQuery->where('cpf_hash', hash('sha256', $row['cpf']));
            } else {
                $collaboratorQuery->where('nome', $row['nome']);
            }

            $collaborator = $collaboratorQuery->first() ?? new Colaborador;

            $collaborator->fill($this->onlyExistingColumns('colaboradores', [
                'unidade_id' => $units[$row['unit']]->id,
                'funcao_id' => $function->id,
                'user_id' => $user->id,
                'nome' => $row['nome'],
                'apelido' => $row['apelido'],
                'sexo' => 'M',
                'ativo' => true,
                'adiantamento_salarial' => false,
                'cpf' => $row['cpf'],
                'rg' => substr($row['cpf'], 0, 9),
                'cnh' => substr($row['cpf'], 1, 9),
                'validade_cnh' => now()->addYears(3)->toDateString(),
                'data_nascimento' => now()->subYears(32)->toDateString(),
                'data_admissao' => $row['data_admissao'],
                'telefone' => $row['telefone'],
                'email' => $row['email'],
                'endereco_completo' => 'Synthetic demo address',
                'cidade_uf' => 'Demo/SP',
            ]));
            $collaborator->save();

            $collaborators[] = $collaborator;
        }

        return $collaborators;
    }

    /**
     * @param  array<string, Unidade>  $units
     */
    private function upsertCurriculumsAndInterviews(User $user, array $units, Funcao $function): void
    {
        $rows = [
            [
                'name' => 'Demo Ana Martins',
                'phone' => '11991000001',
                'unit' => 'demo-amparo',
                'status' => InterviewCurriculumStatus::ConvocadoEntrevista->value,
                'score' => 8.6,
                'hr' => HrStatus::EmAnalise->value,
                'guep' => GuepStatus::Aprovado->value,
            ],
            [
                'name' => 'Demo Bruno Ferreira',
                'phone' => '11991000002',
                'unit' => 'demo-itapetininga',
                'status' => InterviewCurriculumStatus::AprovadoEntrevista->value,
                'score' => 9.1,
                'hr' => HrStatus::Aprovado->value,
                'guep' => GuepStatus::Aprovado->value,
            ],
            [
                'name' => 'Demo Carla Santos',
                'phone' => '11991000003',
                'unit' => 'demo-amparo',
                'status' => InterviewCurriculumStatus::Descartado->value,
                'score' => 5.4,
                'hr' => HrStatus::Reprovado->value,
                'guep' => GuepStatus::NaoFazer->value,
            ],
        ];

        foreach ($rows as $index => $row) {
            $curriculum = InterviewCurriculum::query()->updateOrCreate(
                [
                    'author_id' => $user->id,
                    'full_name' => $row['name'],
                ],
                $this->onlyExistingColumns('interview_curriculums', [
                    'phone' => $row['phone'],
                    'role_name' => $function->nome,
                    'unit_name' => $units[$row['unit']]->nome,
                    'observacao' => 'Synthetic demo resume for portfolio recording.',
                    'interview_date' => now()->addDays($index + 1)->toDateString(),
                    'interview_time' => sprintf('0%d:30', $index + 8),
                    'document_path' => 'demo/portfolio-curriculum.pdf',
                    'document_original_name' => 'demo-curriculum.pdf',
                    'status' => $row['status'],
                ]),
            );

            DriverInterview::query()->updateOrCreate(
                [
                    'author_id' => $user->id,
                    'full_name' => $row['name'],
                ],
                $this->onlyExistingColumns('driver_interviews', [
                    'user_id' => $user->id,
                    'preferred_name' => Str::after($row['name'], 'Demo '),
                    'birth_date' => now()->subYears(29 + $index)->toDateString(),
                    'phone' => $row['phone'],
                    'email' => 'candidate'.$index.'.demo@example.com',
                    'city' => 'Demo City/SP',
                    'cargo_pretendido' => $function->nome,
                    'hiring_unidade_id' => $units[$row['unit']]->id,
                    'curriculum_id' => $curriculum->id,
                    'marital_status' => 'Single',
                    'has_children' => false,
                    'cpf' => '9100000000'.$index,
                    'rg' => '4200000'.$index,
                    'cnh_number' => '03000000'.$index,
                    'cnh_category' => 'D',
                    'cnh_expiration_date' => now()->addYears(4)->toDateString(),
                    'ear' => true,
                    'last_company' => 'Demo Logistics',
                    'last_role' => 'Driver',
                    'last_city' => 'Demo City',
                    'last_period_start' => now()->subYears(3)->toDateString(),
                    'last_period_end' => now()->subMonths(2)->toDateString(),
                    'last_exit_reason' => 'Career transition',
                    'previous_company' => 'Demo Transport',
                    'previous_role' => 'Driver Assistant',
                    'previous_city' => 'Demo City',
                    'previous_period_start' => now()->subYears(5)->toDateString(),
                    'previous_period_end' => now()->subYears(3)->toDateString(),
                    'previous_exit_reason' => 'Contract ended',
                    'relevant_experience' => 'Synthetic record showing livestock transport experience.',
                    'truck_types_operated' => 'Truck and trailer',
                    'night_shift_experience' => true,
                    'live_animals_transport_experience' => true,
                    'accident_history' => false,
                    'schedule_availability' => 'Full availability',
                    'start_availability_date' => now()->addWeek()->toDateString(),
                    'knows_company_contact' => false,
                    'expectations_about_company' => 'Stable long-term work and professional growth.',
                    'last_salary' => 3200 + ($index * 150),
                    'salary_expectation' => 3800 + ($index * 150),
                    'posture_communication' => 'Clear communication during the demo interview.',
                    'perceived_experience' => 'Consistent operational experience.',
                    'general_observations' => 'Synthetic comments included to validate printing and PDF output.',
                    'candidate_interest' => CandidateInterest::Alto->value,
                    'availability_matches' => true,
                    'overall_score' => $row['score'],
                    'hr_status' => $row['hr'],
                    'guep_status' => $row['guep'],
                    'foi_contratado' => $row['hr'] === HrStatus::Aprovado->value,
                ]),
            );
        }
    }

    /**
     * @param  array<int, Colaborador>  $collaborators
     */
    private function upsertPayroll(User $user, array $collaborators, TipoPagamento $paymentType): void
    {
        foreach ($collaborators as $index => $collaborator) {
            Pagamento::query()->updateOrCreate(
                [
                    'colaborador_id' => $collaborator->id,
                    'competencia_mes' => now()->month,
                    'competencia_ano' => now()->year,
                ],
                $this->onlyExistingColumns('pagamentos', [
                    'unidade_id' => $collaborator->unidade_id,
                    'autor_id' => $user->id,
                    'tipo_pagamento_id' => $paymentType->id,
                    'valor' => 4200 + ($index * 275),
                    'descricao' => 'Demo payroll launch',
                    'data_pagamento' => now()->toDateString(),
                    'observacao' => 'Synthetic payroll record for demo account.',
                    'lancado_em' => now(),
                ]),
            );
        }
    }

    /**
     * @param  array<int, Colaborador>  $collaborators
     */
    private function upsertVacations(User $user, array $collaborators, Funcao $function): void
    {
        foreach ($collaborators as $index => $collaborator) {
            FeriasLancamento::query()->updateOrCreate(
                [
                    'colaborador_id' => $collaborator->id,
                    'data_inicio' => now()->addMonths($index + 1)->startOfMonth()->toDateString(),
                ],
                [
                    'unidade_id' => $collaborator->unidade_id,
                    'funcao_id' => $function->id,
                    'autor_id' => $user->id,
                    'tipo' => 'programada',
                    'com_abono' => false,
                    'dias_ferias' => 15,
                    'data_fim' => now()->addMonths($index + 1)->startOfMonth()->addDays(14)->toDateString(),
                    'periodo_aquisitivo_inicio' => now()->subYear()->toDateString(),
                    'periodo_aquisitivo_fim' => now()->subDay()->toDateString(),
                    'observacoes' => 'Synthetic vacation planning record.',
                ],
            );
        }
    }

    /**
     * @param  array<string, Unidade>  $units
     */
    private function upsertFreight(User $user, array $units): void
    {
        $baseDate = Carbon::now()->startOfMonth();
        $unitRows = [
            'demo-amparo' => ['fleet' => 12, 'frete' => 186500, 'viagens' => 210, 'aves' => 742000, 'km' => 21800],
            'demo-itapetininga' => ['fleet' => 9, 'frete' => 141750, 'viagens' => 165, 'aves' => 584500, 'km' => 17450],
        ];

        foreach ($unitRows as $slug => $row) {
            $unit = $units[$slug];

            UnitFleetSize::query()->updateOrCreate(
                [
                    'unidade_id' => $unit->id,
                    'reference_month' => $baseDate->toDateString(),
                ],
                ['fleet_size' => $row['fleet']],
            );

            for ($day = 0; $day < 3; $day++) {
                $factor = 1 + ($day * 0.08);
                $date = $baseDate->copy()->addDays($day + 2)->toDateString();
                $frete = round($row['frete'] * $factor, 2);
                $km = round($row['km'] * $factor, 2);
                $aves = (int) round($row['aves'] * $factor);
                $viagens = (int) round($row['viagens'] * $factor);
                $thirdPartyFreight = round($frete * 0.08, 2);

                FreightEntry::query()->updateOrCreate(
                    [
                        'data' => $date,
                        'unidade_id' => $unit->id,
                    ],
                    $this->onlyExistingColumns('freight_entries', [
                        'autor_id' => $user->id,
                        'frete_total' => $frete,
                        'cargas' => $viagens,
                        'aves' => $aves,
                        'veiculos' => $row['fleet'],
                        'km_rodado' => $km,
                        'km_terceiros' => round($km * 0.08, 2),
                        'frete_terceiros' => $thirdPartyFreight,
                        'viagens_terceiros' => max(1, (int) round($viagens * 0.08)),
                        'aves_terceiros' => (int) round($aves * 0.08),
                        'frete_liquido' => $frete - $thirdPartyFreight,
                        'cargas_liq' => max(0, $viagens - (int) round($viagens * 0.08)),
                        'aves_liq' => (int) round($aves * 0.92),
                        'kaique' => $frete - $thirdPartyFreight,
                        'vdm' => 0,
                        'frete_programado' => $frete,
                        'km_programado' => $km,
                        'cargas_programadas' => $viagens,
                        'aves_programadas' => $aves,
                        'cargas_canceladas_escaladas' => 1,
                        'nao_escaladas' => 0,
                        'placas' => 'DEMO-1001, DEMO-1002',
                        'obs' => 'Synthetic freight launch for portfolio demo.',
                        'programado_frete' => $frete,
                        'programado_viagens' => $viagens,
                        'programado_aves' => $aves,
                        'programado_km' => $km,
                        'kaique_geral_frete' => $frete - $thirdPartyFreight,
                        'kaique_geral_viagens' => max(0, $viagens - (int) round($viagens * 0.08)),
                        'kaique_geral_aves' => (int) round($aves * 0.92),
                        'kaique_geral_km' => round($km * 0.92, 2),
                        'terceiros_frete' => $thirdPartyFreight,
                        'terceiros_viagens' => max(1, (int) round($viagens * 0.08)),
                        'terceiros_aves' => (int) round($aves * 0.08),
                        'terceiros_km' => round($km * 0.08, 2),
                        'abatedouro_frete' => 0,
                        'abatedouro_viagens' => 0,
                        'abatedouro_aves' => 0,
                        'abatedouro_km' => 0,
                        'canceladas_sem_escalar_frete' => 0,
                        'canceladas_sem_escalar_viagens' => 0,
                        'canceladas_sem_escalar_aves' => 0,
                        'canceladas_sem_escalar_km' => 0,
                        'canceladas_escaladas_frete' => 0,
                        'canceladas_escaladas_viagens' => 1,
                        'canceladas_escaladas_aves' => 0,
                        'canceladas_escaladas_km' => 0,
                    ]),
                );
            }
        }
    }

    /**
     * @param  array<string, Unidade>  $units
     * @return array<string, PlacaFrota>
     */
    private function upsertFleetPlates(array $units): array
    {
        $records = [
            'demo-amparo' => 'DMO1A01',
            'demo-itapetininga' => 'DMO1B02',
        ];

        $plates = [];

        foreach ($records as $slug => $plate) {
            $plates[$slug] = PlacaFrota::query()->updateOrCreate(
                ['placa' => $plate],
                ['unidade_id' => $units[$slug]->id],
            );
        }

        return $plates;
    }

    /**
     * @param  array<string, Unidade>  $units
     * @param  array<int, Colaborador>  $collaborators
     * @param  array<string, PlacaFrota>  $plates
     */
    private function upsertProgramming(User $user, array $units, array $collaborators, array $plates): void
    {
        $index = 0;

        foreach ($units as $slug => $unit) {
            $trip = ProgramacaoViagem::query()->updateOrCreate(
                [
                    'data_viagem' => now()->addDays($index + 1)->toDateString(),
                    'unidade_id' => $unit->id,
                    'codigo_viagem' => 'DEMO-'.($index + 1),
                ],
                $this->onlyExistingColumns('programacao_viagens', [
                    'origem' => $unit->nome,
                    'destino' => 'Granja Demo '.($index + 1),
                    'aviario' => 'Aviário '.($index + 1),
                    'cidade' => 'Cidade Demo/SP',
                    'distancia_km' => 145 + ($index * 25),
                    'equipe' => 'Equipe '.($index + 1),
                    'aves' => 82000 + ($index * 6000),
                    'numero_carga' => 'Carga '.($index + 1),
                    'hora_inicio_prevista' => '06:00',
                    'hora_carregamento_prevista' => '08:30',
                    'hora_fim_prevista' => '13:00',
                    'jornada_horas_prevista' => 7.5,
                    'observacoes' => 'Viagem sintética para demonstração.',
                    'import_lote' => 'demo-portfolio',
                    'ordem_importacao' => $index + 1,
                    'autor_id' => $user->id,
                ]),
            );

            ProgramacaoEscala::query()->updateOrCreate(
                ['programacao_viagem_id' => $trip->id],
                [
                    'colaborador_id' => $collaborators[$index % count($collaborators)]->id,
                    'placa_frota_id' => $plates[$slug]->id,
                    'autor_id' => $user->id,
                    'observacoes' => 'Escala sintética para demonstração.',
                ],
            );

            $index++;
        }
    }

    /**
     * @param  array<string, Unidade>  $units
     * @param  array<int, Colaborador>  $collaborators
     * @param  array<string, PlacaFrota>  $plates
     */
    private function upsertFines(User $user, array $units, array $collaborators, array $plates): void
    {
        $infraction = MultaInfracao::query()->firstOrCreate(
            ['nome' => 'Excesso de velocidade'],
            ['ativo' => true],
        );
        $agency = MultaOrgaoAutuador::query()->firstOrCreate(
            ['nome' => 'Órgão Demo'],
            ['ativo' => true],
        );

        $index = 0;

        foreach ($units as $slug => $unit) {
            Multa::query()->updateOrCreate(
                [
                    'numero_auto_infracao' => 'DEMO-AUTO-'.($index + 1),
                    'autor_id' => $user->id,
                ],
                $this->onlyExistingColumns('multas', [
                    'data' => now()->subDays($index + 2)->toDateString(),
                    'hora' => '10:30',
                    'tipo_registro' => 'multa',
                    'unidade_id' => $unit->id,
                    'placa_frota_id' => $plates[$slug]->id,
                    'multa_infracao_id' => $infraction->id,
                    'multa_orgao_autuador_id' => $agency->id,
                    'colaborador_id' => $collaborators[$index % count($collaborators)]->id,
                    'descricao' => 'Registro sintético para demonstração do painel de multas.',
                    'indicado_condutor' => true,
                    'culpa' => 'motorista',
                    'valor' => 195.23 + ($index * 80),
                    'tipo_valor' => 'normal',
                    'vencimento' => now()->addDays(20 + $index)->toDateString(),
                    'status' => $index === 0 ? 'solicitado_boleto' : 'aguardando_motorista',
                    'descontar' => false,
                ]),
            );

            $index++;
        }
    }

    /**
     * @param  array<string, Unidade>  $units
     */
    private function upsertOperationalTasks(User $user, array $units): void
    {
        foreach (array_values($units) as $index => $unit) {
            OperationalTask::query()->updateOrCreate(
                [
                    'created_by' => $user->id,
                    'title' => 'Revisar pendência operacional '.($index + 1),
                ],
                [
                    'module_key' => $index === 0 ? 'freight' : 'registry',
                    'unidade_id' => $unit->id,
                    'description' => 'Tarefa sintética para manter o painel de pendências útil na conta demo.',
                    'priority' => $index === 0 ? 'high' : 'normal',
                    'status' => 'open',
                    'due_at' => now()->addDays($index + 1),
                    'assigned_to' => $user->id,
                    'metadata' => ['demo' => true],
                ],
            );
        }
    }

    private function deleteDemoData(User $user): void
    {
        $unitIds = Unidade::query()
            ->whereIn('slug', $this->demoUnitSlugs)
            ->pluck('id')
            ->map(fn ($value): int => (int) $value)
            ->all();

        if ($unitIds !== []) {
            OperationalTask::query()->where('created_by', $user->id)->whereIn('unidade_id', $unitIds)->delete();
            ProgramacaoEscala::query()->where('autor_id', $user->id)->delete();
            ProgramacaoViagem::query()->where('autor_id', $user->id)->whereIn('unidade_id', $unitIds)->delete();
            Multa::query()->where('autor_id', $user->id)->whereIn('unidade_id', $unitIds)->delete();
            FreightEntry::query()->whereIn('unidade_id', $unitIds)->where('autor_id', $user->id)->delete();
            UnitFleetSize::query()->whereIn('unidade_id', $unitIds)->delete();
            PlacaFrota::query()->whereIn('unidade_id', $unitIds)->where('placa', 'like', 'DMO%')->delete();
            Pagamento::query()->where('autor_id', $user->id)->whereIn('unidade_id', $unitIds)->delete();
            FeriasLancamento::query()->where('autor_id', $user->id)->whereIn('unidade_id', $unitIds)->delete();
            Colaborador::withTrashed()->whereIn('unidade_id', $unitIds)->where('user_id', $user->id)->forceDelete();
        }

        DriverInterview::withTrashed()->where('author_id', $user->id)->forceDelete();
        InterviewCurriculum::withTrashed()->where('author_id', $user->id)->forceDelete();
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array<string, mixed>
     */
    private function onlyExistingColumns(string $table, array $attributes): array
    {
        return collect($attributes)
            ->filter(fn (mixed $value, string $column): bool => Schema::hasColumn($table, $column))
            ->all();
    }
}
