<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BobAssistantMessage;
use App\Models\Colaborador;
use App\Models\DriverInterview;
use App\Models\FeriasLancamento;
use App\Models\FreightEntry;
use App\Models\Pagamento;
use App\Models\TipoPagamento;
use App\Models\Unidade;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Throwable;

class BobAssistantController extends Controller
{
    public function chat(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:4000'],
        ]);

        $message = trim((string) $validated['message']);
        $normalized = $this->normalizeText($message);
        $response = null;

        if ($this->isHelpIntent($normalized)) {
            $response = response()->json([
                'reply' => $this->helpMessage(),
                'intent' => 'help',
            ]);
            return $this->persistConversationAndRespond($request, $message, $response);
        }

        if ($this->isLaunchPaymentIntent($normalized)) {
            $response = $this->handleLaunchPayment($request, $message);
            return $this->persistConversationAndRespond($request, $message, $response);
        }

        if ($this->isCollaboratorPaymentsIntent($normalized)) {
            $response = $this->handleCollaboratorPaymentsByMonth($request, $message);
            return $this->persistConversationAndRespond($request, $message, $response);
        }

        if ($this->isCollaboratorInfoIntent($normalized)) {
            $response = $this->handleCollaboratorInfo($message);
            return $this->persistConversationAndRespond($request, $message, $response);
        }

        if ($this->isSystemOverviewIntent($normalized)) {
            $response = $this->handleSystemOverview($request);
            return $this->persistConversationAndRespond($request, $message, $response);
        }

        if ($this->isVacationDueIntent($normalized)) {
            $response = $this->handleVacationDueByCollaborator($message);
            return $this->persistConversationAndRespond($request, $message, $response);
        }

        if ($this->isPayrollSummaryIntent($normalized)) {
            $response = $this->handlePayrollSummary($request, $message);
            return $this->persistConversationAndRespond($request, $message, $response);
        }

        if ($this->isInterviewSummaryIntent($normalized)) {
            $response = $this->handleInterviewSummary($request);
            return $this->persistConversationAndRespond($request, $message, $response);
        }

        if ($this->isLaunchFreightIntent($normalized)) {
            $response = $this->handleLaunchFreight($request, $message);
            return $this->persistConversationAndRespond($request, $message, $response);
        }

        if ($this->isFreightSummaryIntent($normalized)) {
            $response = $this->handleFreightSummary($request, $message);
            return $this->persistConversationAndRespond($request, $message, $response);
        }

        if ($this->isFreightDateIntent($normalized)) {
            $response = $this->handleFreightByDate($request, $message);
            return $this->persistConversationAndRespond($request, $message, $response);
        }

        $response = $this->handleBroadSystemQuery($request, $message, $normalized);

        if ($response !== null) {
            return $this->persistConversationAndRespond($request, $message, $response);
        }

        $response = response()->json([
            'reply' => "Posso executar praticamente tudo do sistema por comando textual, mas preciso que você informe módulo + alvo + período/valor quando existir.\n\nExemplos:\n- ver dados do colaborador Adair\n- quanto Adair recebeu de adiantamento em março 2026\n- lancar pagamento colaborador Adair tipo Salário valor 3500 competencia 03/2026\n- resumo fretes março 2026 unidade Amparo\n- resumo entrevistas",
            'intent' => 'fallback',
        ]);

        return $this->persistConversationAndRespond($request, $message, $response);
    }

    public function history(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $messages = BobAssistantMessage::query()
            ->where('user_id', (int) $request->user()->id)
            ->orderBy('id')
            ->limit(250)
            ->get(['id', 'role', 'content', 'created_at'])
            ->map(fn (BobAssistantMessage $message) => [
                'id' => (string) $message->id,
                'role' => $message->role === 'assistant' ? 'bob' : 'user',
                'content' => $message->content,
                'created_at' => optional($message->created_at)?->toIso8601String(),
            ]);

        return response()->json([
            'messages' => $messages,
        ]);
    }

    public function clearHistory(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        BobAssistantMessage::query()
            ->where('user_id', (int) $request->user()->id)
            ->delete();

        return response()->json([], 204);
    }

    private function handleFreightByDate(Request $request, string $message): JsonResponse
    {
        $date = $this->extractDate($message);

        if (! $date) {
            return response()->json([
                'reply' => 'Não consegui identificar a data. Exemplo: "fretes do dia 01/03/2026".',
                'intent' => 'freight_by_date',
            ]);
        }

        $unit = $this->extractUnit($message);

        $query = $this->entriesQueryForUser($request)
            ->whereDate('data', $date->toDateString())
            ->with('unidade:id,nome')
            ->orderBy('unidade_id');

        if ($unit) {
            $query->where('unidade_id', $unit->id);
        }

        $entries = $query->limit(60)->get();

        if ($entries->isEmpty()) {
            return response()->json([
                'reply' => sprintf('Não encontrei fretes lançados em %s%s.', $date->format('d/m/Y'), $unit ? ' para a unidade '.$unit->nome : ''),
                'intent' => 'freight_by_date',
            ]);
        }

        $totalFrete = (float) $entries->sum('frete_total');
        $totalKm = (float) $entries->sum('km_rodado');
        $totalCargas = (int) $entries->sum('cargas');
        $totalAves = (int) $entries->sum('aves');

        $lines = [
            sprintf('Fretes em %s%s:', $date->format('d/m/Y'), $unit ? ' ('.$unit->nome.')' : ''),
            sprintf('- Lançamentos: %d', $entries->count()),
            sprintf('- Frete total: R$ %s', number_format($totalFrete, 2, ',', '.')),
            sprintf('- KM total: %s', number_format($totalKm, 0, ',', '.')),
            sprintf('- Cargas: %s', number_format($totalCargas, 0, ',', '.')),
            sprintf('- Aves: %s', number_format($totalAves, 0, ',', '.')),
            '',
            'Detalhes:',
        ];

        foreach ($entries->take(10) as $entry) {
            $lines[] = sprintf(
                '- %s | Frete R$ %s | KM %s | Cargas %d | Aves %d',
                $entry->unidade?->nome ?? 'Sem unidade',
                number_format((float) $entry->frete_total, 2, ',', '.'),
                number_format((float) $entry->km_rodado, 0, ',', '.'),
                (int) $entry->cargas,
                (int) $entry->aves,
            );
        }

        if ($entries->count() > 10) {
            $lines[] = sprintf('... e mais %d lançamento(s).', $entries->count() - 10);
        }

        return response()->json([
            'reply' => implode("\n", $lines),
            'intent' => 'freight_by_date',
        ]);
    }

    private function handleFreightSummary(Request $request, string $message): JsonResponse
    {
        [$month, $year] = $this->extractMonthYear($message);
        $unit = $this->extractUnit($message);

        $query = $this->entriesQueryForUser($request)
            ->whereYear('data', $year)
            ->whereMonth('data', $month);

        if ($unit) {
            $query->where('unidade_id', $unit->id);
        }

        $entries = (clone $query)->with('unidade:id,nome')->get();

        if ($entries->isEmpty()) {
            return response()->json([
                'reply' => sprintf('Não encontrei lançamentos de frete em %02d/%04d%s.', $month, $year, $unit ? ' para '.$unit->nome : ''),
                'intent' => 'freight_summary',
            ]);
        }

        $totalFrete = (float) $entries->sum('frete_total');
        $totalKm = (float) $entries->sum('km_rodado');
        $totalCargas = (int) $entries->sum('cargas');
        $totalAves = (int) $entries->sum('aves');
        $dias = $entries->pluck('data')->map(fn ($date) => Carbon::parse((string) $date)->toDateString())->unique()->count();
        $fretePorKm = $totalKm > 0 ? ($totalFrete / $totalKm) : 0;

        $topByUnit = $entries
            ->groupBy('unidade_id')
            ->map(fn ($group) => [
                'unidade' => $group->first()?->unidade?->nome ?? 'Sem unidade',
                'frete' => (float) $group->sum('frete_total'),
            ])
            ->sortByDesc('frete')
            ->values()
            ->take(3);

        $lines = [
            sprintf('Resumo de fretes %02d/%04d%s', $month, $year, $unit ? ' ('.$unit->nome.')' : ''),
            sprintf('- Lançamentos: %d', $entries->count()),
            sprintf('- Dias com operação: %d', $dias),
            sprintf('- Frete total: R$ %s', number_format($totalFrete, 2, ',', '.')),
            sprintf('- KM total: %s', number_format($totalKm, 0, ',', '.')),
            sprintf('- Frete/KM: R$ %s', number_format($fretePorKm, 2, ',', '.')),
            sprintf('- Cargas: %s', number_format($totalCargas, 0, ',', '.')),
            sprintf('- Aves: %s', number_format($totalAves, 0, ',', '.')),
            '',
            'Top unidades por frete:',
        ];

        foreach ($topByUnit as $row) {
            $lines[] = sprintf('- %s: R$ %s', $row['unidade'], number_format((float) $row['frete'], 2, ',', '.'));
        }

        return response()->json([
            'reply' => implode("\n", $lines),
            'intent' => 'freight_summary',
        ]);
    }

    private function handleLaunchFreight(Request $request, string $message): JsonResponse
    {
        $date = $this->extractDate($message);
        $unit = $this->extractUnit($message);
        $freteTotal = $this->extractNumberByKeywords($message, ['frete total', 'frete']);
        $cargas = (int) round($this->extractNumberByKeywords($message, ['cargas', 'viagens']) ?? 0);
        $aves = (int) round($this->extractNumberByKeywords($message, ['aves']) ?? 0);
        $veiculos = (int) round($this->extractNumberByKeywords($message, ['veiculos', 'veículos', 'caminhoes', 'caminhões']) ?? 0);
        $kmRodado = $this->extractNumberByKeywords($message, ['km rodado', 'km']) ?? 0;

        $freteTerceiros = $this->extractNumberByKeywords($message, ['terceiros frete', 'frete terceiros']) ?? 0;
        $viagensTerceiros = (int) round($this->extractNumberByKeywords($message, ['terceiros viagens', 'viagens terceiros']) ?? 0);
        $avesTerceiros = (int) round($this->extractNumberByKeywords($message, ['terceiros aves', 'aves terceiros']) ?? 0);

        if (! $date || ! $unit || $freteTotal === null || $cargas <= 0 || $kmRodado <= 0) {
            return response()->json([
                'reply' => "Para lançar frete preciso de: data, unidade, frete, cargas e km.\n\nExemplo:\n\"lancar frete data 01/03/2026 unidade Amparo frete 12000 cargas 12 aves 1800 veiculos 3 km 11000 terceiros frete 500 terceiros viagens 1 terceiros aves 120\"",
                'intent' => 'launch_freight',
            ]);
        }

        if ($kmRodado < 1000 || $kmRodado > 25000) {
            return response()->json([
                'reply' => 'KM inválido para lançamento diário. Use um valor entre 1000 e 25000.',
                'intent' => 'launch_freight',
            ]);
        }

        $freteLiquido = max(0, $freteTotal - $freteTerceiros);
        $cargasLiq = max(0, $cargas - $viagensTerceiros);
        $avesLiq = max(0, $aves - $avesTerceiros);

        $payload = [
            'data' => $date->toDateString(),
            'unidade_id' => $unit->id,
            'autor_id' => (int) $request->user()->id,
            'frete_total' => $freteTotal,
            'cargas' => $cargas,
            'aves' => $aves,
            'veiculos' => $veiculos,
            'km_rodado' => $kmRodado,
            'frete_terceiros' => $freteTerceiros,
            'viagens_terceiros' => $viagensTerceiros,
            'aves_terceiros' => $avesTerceiros,
            'frete_liquido' => $freteLiquido,
            'cargas_liq' => $cargasLiq,
            'aves_liq' => $avesLiq,
            'programado_frete' => 0,
            'programado_viagens' => 0,
            'programado_aves' => 0,
            'programado_km' => 0,
            'kaique_geral_frete' => $freteTotal,
            'kaique_geral_viagens' => $cargas,
            'kaique_geral_aves' => $aves,
            'kaique_geral_km' => $kmRodado,
            'terceiros_frete' => $freteTerceiros,
            'terceiros_viagens' => $viagensTerceiros,
            'terceiros_aves' => $avesTerceiros,
            'terceiros_km' => 0,
            'abatedouro_frete' => $freteLiquido,
            'abatedouro_viagens' => $cargasLiq,
            'abatedouro_aves' => $avesLiq,
            'abatedouro_km' => $kmRodado,
            'canceladas_sem_escalar_frete' => 0,
            'canceladas_sem_escalar_viagens' => 0,
            'canceladas_sem_escalar_aves' => 0,
            'canceladas_sem_escalar_km' => 0,
            'canceladas_escaladas_frete' => 0,
            'canceladas_escaladas_viagens' => 0,
            'canceladas_escaladas_aves' => 0,
            'canceladas_escaladas_km' => 0,
            'kaique' => 0,
            'vdm' => 0,
            'frete_programado' => 0,
            'km_programado' => 0,
            'cargas_programadas' => 0,
            'aves_programadas' => 0,
            'cargas_canceladas_escaladas' => 0,
            'nao_escaladas' => 0,
            'placas' => null,
            'obs' => 'Lançado via Bob',
        ];

        $entry = FreightEntry::query()->updateOrCreate(
            [
                'data' => $date->toDateString(),
                'unidade_id' => $unit->id,
            ],
            $payload,
        );

        return response()->json([
            'reply' => sprintf(
                'Lançamento salvo com sucesso.\n- Data: %s\n- Unidade: %s\n- Frete: R$ %s\n- Cargas: %d\n- Aves: %d\n- KM: %s\n- ID: %d',
                $date->format('d/m/Y'),
                $unit->nome,
                number_format($freteTotal, 2, ',', '.'),
                $cargas,
                $aves,
                number_format($kmRodado, 0, ',', '.'),
                (int) $entry->id,
            ),
            'intent' => 'launch_freight',
        ]);
    }

    private function entriesQueryForUser(Request $request): Builder
    {
        $query = FreightEntry::query();

        if (! $request->user()?->isMasterAdmin()) {
            $query->where('autor_id', $request->user()->id);
        }

        return $query;
    }

    private function handleSystemOverview(Request $request): JsonResponse
    {
        $month = now()->month;
        $year = now()->year;

        $freightQuery = $this->entriesQueryForUser($request)
            ->whereYear('data', $year)
            ->whereMonth('data', $month);

        $payrollQuery = Pagamento::query()
            ->where('competencia_mes', $month)
            ->where('competencia_ano', $year);

        if (! $request->user()?->isMasterAdmin()) {
            $payrollQuery->where('autor_id', $request->user()->id);
        }

        $interviewQuery = DriverInterview::query();
        if (! $request->user()?->isMasterAdmin()) {
            $interviewQuery->where('author_id', $request->user()->id);
        }

        $vacationsExpired = $this->countExpiredVacations();

        $lines = [
            sprintf('Visão geral do sistema (%02d/%04d)', $month, $year),
            sprintf('- Fretes lançados: %d', (clone $freightQuery)->count()),
            sprintf('- Frete total: R$ %s', number_format((float) ((clone $freightQuery)->sum('frete_total')), 2, ',', '.')),
            sprintf('- Pagamentos lançados: %d', (clone $payrollQuery)->count()),
            sprintf('- Total em pagamentos: R$ %s', number_format((float) ((clone $payrollQuery)->sum('valor')), 2, ',', '.')),
            sprintf('- Entrevistas registradas: %d', (clone $interviewQuery)->count()),
            sprintf('- Férias vencidas (colaboradores ativos): %d', $vacationsExpired),
        ];

        return response()->json([
            'reply' => implode("\n", $lines),
            'intent' => 'system_overview',
        ]);
    }

    private function handlePayrollSummary(Request $request, string $message): JsonResponse
    {
        [$month, $year] = $this->extractMonthYear($message);
        $unit = $this->extractUnit($message);

        $query = Pagamento::query()
            ->where('competencia_mes', $month)
            ->where('competencia_ano', $year)
            ->with('unidade:id,nome');

        if ($unit) {
            $query->where('unidade_id', $unit->id);
        }

        if (! $request->user()?->isMasterAdmin()) {
            $query->where('autor_id', $request->user()->id);
        }

        $rows = $query->get();

        if ($rows->isEmpty()) {
            return response()->json([
                'reply' => sprintf('Não encontrei pagamentos em %02d/%04d%s.', $month, $year, $unit ? ' para '.$unit->nome : ''),
                'intent' => 'payroll_summary',
            ]);
        }

        $total = (float) $rows->sum('valor');
        $colaboradores = $rows->pluck('colaborador_id')->unique()->count();

        $topUnidades = $rows
            ->groupBy('unidade_id')
            ->map(fn ($group) => [
                'nome' => $group->first()?->unidade?->nome ?? 'Sem unidade',
                'valor' => (float) $group->sum('valor'),
            ])
            ->sortByDesc('valor')
            ->values()
            ->take(3);

        $lines = [
            sprintf('Resumo de pagamentos %02d/%04d%s', $month, $year, $unit ? ' ('.$unit->nome.')' : ''),
            sprintf('- Lançamentos: %d', $rows->count()),
            sprintf('- Colaboradores com pagamento: %d', $colaboradores),
            sprintf('- Total pago: R$ %s', number_format($total, 2, ',', '.')),
            '',
            'Top unidades por valor:',
        ];

        foreach ($topUnidades as $row) {
            $lines[] = sprintf('- %s: R$ %s', $row['nome'], number_format((float) $row['valor'], 2, ',', '.'));
        }

        return response()->json([
            'reply' => implode("\n", $lines),
            'intent' => 'payroll_summary',
        ]);
    }

    private function handleInterviewSummary(Request $request): JsonResponse
    {
        $query = DriverInterview::query();

        if (! $request->user()?->isMasterAdmin()) {
            $query->where('author_id', $request->user()->id);
        }

        $total = (clone $query)->count();
        $aprovadas = (clone $query)->where('hr_status', 'aprovado')->count();
        $reprovadas = (clone $query)->where('hr_status', 'reprovado')->count();
        $emAnalise = (clone $query)->where('hr_status', 'em_analise')->count();
        $aguardandoVaga = (clone $query)->where('hr_status', 'aguardando_vaga')->count();

        return response()->json([
            'reply' => implode("\n", [
                'Resumo de entrevistas',
                sprintf('- Total: %d', $total),
                sprintf('- Aprovadas: %d', $aprovadas),
                sprintf('- Reprovadas: %d', $reprovadas),
                sprintf('- Em análise: %d', $emAnalise),
                sprintf('- Aguardando vaga: %d', $aguardandoVaga),
            ]),
            'intent' => 'interview_summary',
        ]);
    }

    private function handleVacationDueByCollaborator(string $message): JsonResponse
    {
        $collaborator = $this->extractCollaborator($message);

        if (! $collaborator || ! $collaborator->data_admissao) {
            return response()->json([
                'reply' => 'Não consegui identificar o colaborador com data de admissão válida. Exemplo: "quando vai vencer as ferias do Adair".',
                'intent' => 'vacation_due',
            ]);
        }

        $lastPeriodEnd = FeriasLancamento::query()
            ->where('colaborador_id', $collaborator->id)
            ->max('periodo_aquisitivo_fim');

        $base = Carbon::parse($lastPeriodEnd ?: $collaborator->data_admissao->toDateString())->startOfDay();
        $today = now()->startOfDay();
        $daysSinceBase = max($base->diffInDays($today) + 1, 1);
        $status = $this->resolveVacationStatusByDays($daysSinceBase);

        $direito = $base->copy()->addYear();
        $limite = $direito->copy()->addMonths(11);
        $daysToExpire = $today->diffInDays($limite, false);

        $lines = [
            sprintf('Férias de %s', $collaborator->nome),
            sprintf('- Período aquisitivo: %s a %s', $base->format('d/m/Y'), $base->copy()->addDays(364)->format('d/m/Y')),
            sprintf('- Direito: %s', $direito->format('d/m/Y')),
            sprintf('- Limite para vencer: %s', $limite->format('d/m/Y')),
            sprintf('- Status: %s', $status),
            $daysToExpire >= 0
                ? sprintf('- Dias para vencer: %d', $daysToExpire)
                : sprintf('- Vencida há %d dia(s)', abs($daysToExpire)),
        ];

        return response()->json([
            'reply' => implode("\n", $lines),
            'intent' => 'vacation_due',
        ]);
    }

    private function countExpiredVacations(): int
    {
        $today = now()->startOfDay();

        $collaborators = Colaborador::query()
            ->where('ativo', true)
            ->whereNotNull('data_admissao')
            ->get(['id', 'data_admissao']);

        if ($collaborators->isEmpty()) {
            return 0;
        }

        $latestPeriodEndByCollaborator = FeriasLancamento::query()
            ->whereIn('colaborador_id', $collaborators->pluck('id')->all())
            ->selectRaw('colaborador_id, MAX(periodo_aquisitivo_fim) as base_fim')
            ->groupBy('colaborador_id')
            ->pluck('base_fim', 'colaborador_id');

        $expired = 0;

        foreach ($collaborators as $collaborator) {
            $baseDate = (string) ($latestPeriodEndByCollaborator->get($collaborator->id) ?? $collaborator->data_admissao?->toDateString());

            if ($baseDate === '') {
                continue;
            }

            $base = Carbon::parse($baseDate)->startOfDay();
            $limite = $base->copy()->addYear()->addMonths(11);

            if ($limite->lt($today)) {
                $expired++;
            }
        }

        return $expired;
    }

    private function isHelpIntent(string $message): bool
    {
        return str_contains($message, 'ajuda')
            || str_contains($message, 'o que voce faz')
            || str_contains($message, 'o que voce consegue')
            || str_contains($message, 'comandos');
    }

    private function isLaunchPaymentIntent(string $message): bool
    {
        return str_contains($message, 'lancar pagamento')
            || str_contains($message, 'lançar pagamento')
            || str_contains($message, 'criar pagamento')
            || str_contains($message, 'registrar pagamento');
    }

    private function isCollaboratorPaymentsIntent(string $message): bool
    {
        return (str_contains($message, 'pagamento') || str_contains($message, 'ganhou') || str_contains($message, 'recebeu'))
            && (str_contains($message, 'colaborador')
            || str_contains($message, 'do ')
            || str_contains($message, 'da ')
            || str_contains($message, 'de ')
            || str_contains($message, 'adiantamento')
            || str_contains($message, 'salario')
            || str_contains($message, 'salário'));
    }

    private function isCollaboratorInfoIntent(string $message): bool
    {
        $context = str_contains($message, 'colaborador')
            || str_contains($message, 'funcionario')
            || str_contains($message, 'funcionário')
            || str_contains($message, 'admissao')
            || str_contains($message, 'admissão')
            || str_contains($message, 'dados');

        return $context && ! $this->isCollaboratorPaymentsIntent($message);
    }

    private function isLaunchFreightIntent(string $message): bool
    {
        return str_contains($message, 'lancar frete')
            || str_contains($message, 'lançar frete')
            || str_contains($message, 'criar frete')
            || str_contains($message, 'registrar frete');
    }

    private function isFreightSummaryIntent(string $message): bool
    {
        return (str_contains($message, 'frete') || str_contains($message, 'fretes'))
            && (str_contains($message, 'resumo')
            || str_contains($message, 'analise')
            || str_contains($message, 'análise')
            || str_contains($message, 'dashboard de frete')
            || str_contains($message, 'total de frete'));
    }

    private function isFreightDateIntent(string $message): bool
    {
        return str_contains($message, 'fretes do dia')
            || str_contains($message, 'frete do dia')
            || str_contains($message, 'lancamentos de frete do dia')
            || str_contains($message, 'lançamentos de frete do dia');
    }

    private function isPayrollSummaryIntent(string $message): bool
    {
        $isPayrollContext = str_contains($message, 'pagamento')
            || str_contains($message, 'pagamentos')
            || str_contains($message, 'folha')
            || str_contains($message, 'salario')
            || str_contains($message, 'salário');

        $isSummary = str_contains($message, 'resumo')
            || str_contains($message, 'total')
            || str_contains($message, 'competencia')
            || str_contains($message, 'competência');

        return $isPayrollContext && $isSummary;
    }

    private function isVacationDueIntent(string $message): bool
    {
        return (str_contains($message, 'ferias') || str_contains($message, 'férias'))
            && (str_contains($message, 'vence')
            || str_contains($message, 'vencer')
            || str_contains($message, 'vencimento')
            || str_contains($message, 'limite')
            || str_contains($message, 'quando'));
    }

    private function isInterviewSummaryIntent(string $message): bool
    {
        return (str_contains($message, 'entrevista') || str_contains($message, 'entrevistas') || str_contains($message, 'candidato'))
            && (str_contains($message, 'resumo')
            || str_contains($message, 'status')
            || str_contains($message, 'total')
            || str_contains($message, 'aprovad')
            || str_contains($message, 'reprovad'));
    }

    private function isSystemOverviewIntent(string $message): bool
    {
        return str_contains($message, 'visao geral do sistema')
            || str_contains($message, 'visão geral do sistema')
            || str_contains($message, 'resumo do sistema')
            || str_contains($message, 'status do sistema')
            || str_contains($message, 'resumo geral');
    }

    private function handleBroadSystemQuery(Request $request, string $message, string $normalized): ?JsonResponse
    {
        if ((str_contains($normalized, 'admissao') || str_contains($normalized, 'admissão') || str_contains($normalized, 'dados do colaborador'))
            && $this->extractCollaborator($message)) {
            return $this->handleCollaboratorInfo($message);
        }

        if ((str_contains($normalized, 'ganhou') || str_contains($normalized, 'recebeu') || str_contains($normalized, 'adiantamento'))
            && $this->extractCollaborator($message)) {
            return $this->handleCollaboratorPaymentsByMonth($request, $message);
        }

        if (str_contains($normalized, 'dashboard')) {
            if (str_contains($normalized, 'frete')) {
                return $this->handleFreightSummary($request, $message);
            }

            if (str_contains($normalized, 'pagamento') || str_contains($normalized, 'folha')) {
                return $this->handlePayrollSummary($request, $message);
            }

            if (str_contains($normalized, 'ferias') || str_contains($normalized, 'férias')) {
                return response()->json([
                    'reply' => sprintf('Total de férias vencidas de colaboradores ativos: %d', $this->countExpiredVacations()),
                    'intent' => 'vacation_dashboard_quick',
                ]);
            }

            if (str_contains($normalized, 'entrevista')) {
                return $this->handleInterviewSummary($request);
            }
        }

        if ((str_contains($normalized, 'entrevista de') || str_contains($normalized, 'candidato')) && ! $this->isInterviewSummaryIntent($normalized)) {
            return $this->handleInterviewLookupByName($request, $message);
        }

        return null;
    }

    private function handleCollaboratorInfo(string $message): JsonResponse
    {
        $collaborator = $this->extractCollaborator($message);

        if (! $collaborator) {
            return response()->json([
                'reply' => 'Não localizei o colaborador no cadastro ativo. Envie o nome completo ou mais palavras do nome.',
                'intent' => 'collaborator_info',
            ]);
        }

        $collaborator->loadMissing(['unidade:id,nome', 'funcao:id,nome']);

        return response()->json([
            'reply' => implode("\n", [
                sprintf('Dados do colaborador: %s', $collaborator->nome),
                sprintf('- Situação: %s', $collaborator->ativo ? 'Ativo' : 'Inativo'),
                sprintf('- Unidade: %s', $collaborator->unidade?->nome ?? 'Não informado'),
                sprintf('- Função: %s', $collaborator->funcao?->nome ?? 'Não informado'),
                sprintf('- Data de admissão: %s', $collaborator->data_admissao?->format('d/m/Y') ?? 'Não informada'),
                sprintf('- CPF: %s', $collaborator->cpf ?? 'Não informado'),
            ]),
            'intent' => 'collaborator_info',
        ]);
    }

    private function handleCollaboratorPaymentsByMonth(Request $request, string $message): JsonResponse
    {
        $collaborator = $this->extractCollaborator($message);

        if (! $collaborator) {
            return response()->json([
                'reply' => 'Não encontrei o colaborador para consultar pagamentos. Envie o nome com mais detalhes.',
                'intent' => 'collaborator_payments',
            ]);
        }

        [$month, $year] = $this->extractMonthYear($message);

        $query = Pagamento::query()
            ->where('colaborador_id', (int) $collaborator->id)
            ->where('competencia_mes', $month)
            ->where('competencia_ano', $year)
            ->with('tipoPagamento:id,nome');

        if (! $request->user()?->isMasterAdmin()) {
            $query->where('autor_id', $request->user()->id);
        }

        $rows = $query->get();

        if ($rows->isEmpty()) {
            return response()->json([
                'reply' => sprintf('Não encontrei pagamentos de %s em %02d/%04d.', $collaborator->nome, $month, $year),
                'intent' => 'collaborator_payments',
            ]);
        }

        $total = (float) $rows->sum('valor');
        $adiantamento = (float) $rows
            ->filter(fn (Pagamento $payment) => str_contains($this->normalizeText((string) $payment->tipoPagamento?->nome), 'adiant'))
            ->sum('valor');

        $topTypes = $rows
            ->groupBy('tipo_pagamento_id')
            ->map(fn ($group) => [
                'tipo' => $group->first()?->tipoPagamento?->nome ?? 'Sem tipo',
                'total' => (float) $group->sum('valor'),
            ])
            ->sortByDesc('total')
            ->values()
            ->take(5);

        $lines = [
            sprintf('Pagamentos de %s em %02d/%04d', $collaborator->nome, $month, $year),
            sprintf('- Lançamentos: %d', $rows->count()),
            sprintf('- Total recebido: R$ %s', number_format($total, 2, ',', '.')),
            sprintf('- Total de adiantamento: R$ %s', number_format($adiantamento, 2, ',', '.')),
            '',
            'Por tipo:',
        ];

        foreach ($topTypes as $typeRow) {
            $lines[] = sprintf('- %s: R$ %s', $typeRow['tipo'], number_format((float) $typeRow['total'], 2, ',', '.'));
        }

        return response()->json([
            'reply' => implode("\n", $lines),
            'intent' => 'collaborator_payments',
        ]);
    }

    private function handleLaunchPayment(Request $request, string $message): JsonResponse
    {
        $collaborator = $this->extractCollaborator($message);
        $amount = $this->extractNumberByKeywords($message, ['valor', 'pagamento', 'salario', 'salário', 'adiantamento']) ?? 0;
        $paymentDate = $this->extractDate($message) ?? now();
        [$month, $year] = $this->extractMonthYear($message);
        $paymentType = $this->extractPaymentType($message);

        if (! $collaborator || $amount <= 0) {
            return response()->json([
                'reply' => "Para lançar pagamento preciso no mínimo: colaborador e valor.\n\nExemplo:\n\"lancar pagamento colaborador Adair tipo Salário valor 3500 competencia 03/2026 data 25/03/2026\"",
                'intent' => 'launch_payment',
            ]);
        }

        $payload = [
            'colaborador_id' => (int) $collaborator->id,
            'unidade_id' => (int) $collaborator->unidade_id,
            'autor_id' => (int) $request->user()->id,
            'tipo_pagamento_id' => $paymentType?->id,
            'competencia_mes' => $month,
            'competencia_ano' => $year,
            'valor' => $amount,
            'descricao' => $paymentType ? ('Lançado via Bob - '.$paymentType->nome) : 'Lançado via Bob',
            'data_pagamento' => $paymentDate->toDateString(),
            'observacao' => 'Lançado via Bob',
            'lancado_em' => now(),
        ];

        $payment = Pagamento::query()->updateOrCreate(
            [
                'colaborador_id' => (int) $collaborator->id,
                'tipo_pagamento_id' => $paymentType?->id,
                'data_pagamento' => $paymentDate->toDateString(),
            ],
            $payload,
        );

        return response()->json([
            'reply' => implode("\n", [
                'Pagamento lançado com sucesso.',
                sprintf('- Colaborador: %s', $collaborator->nome),
                sprintf('- Tipo: %s', $paymentType?->nome ?? 'Sem tipo'),
                sprintf('- Valor: R$ %s', number_format($amount, 2, ',', '.')),
                sprintf('- Competência: %02d/%04d', $month, $year),
                sprintf('- Data pagamento: %s', $paymentDate->format('d/m/Y')),
                sprintf('- ID: %d', (int) $payment->id),
            ]),
            'intent' => 'launch_payment',
        ]);
    }

    private function handleInterviewLookupByName(Request $request, string $message): JsonResponse
    {
        $terms = collect(preg_split('/\s+/', $this->normalizeText($message)) ?: [])
            ->filter(fn (string $term) => strlen($term) >= 3)
            ->reject(fn (string $term) => in_array($term, ['entrevista', 'entrevistas', 'candidato', 'candidata', 'resumo', 'status', 'ver', 'consultar', 'do', 'da', 'de'], true))
            ->values();

        if ($terms->isEmpty()) {
            return response()->json([
                'reply' => 'Para consultar entrevista específica, envie o nome do candidato.',
                'intent' => 'interview_lookup',
            ]);
        }

        $query = DriverInterview::query();
        foreach ($terms as $term) {
            $query->whereRaw('LOWER(full_name) like ?', ['%'.$term.'%']);
        }

        if (! $request->user()?->isMasterAdmin()) {
            $query->where('author_id', $request->user()->id);
        }

        $interview = $query
            ->orderByDesc('id')
            ->first(['id', 'full_name', 'city', 'hr_status', 'guep_status', 'overall_score', 'created_at']);

        if (! $interview) {
            return response()->json([
                'reply' => 'Não encontrei entrevista com esse nome nos registros acessíveis para seu perfil.',
                'intent' => 'interview_lookup',
            ]);
        }

        return response()->json([
            'reply' => implode("\n", [
                sprintf('Entrevista localizada: %s', (string) $interview->full_name),
                sprintf('- ID: %d', (int) $interview->id),
                sprintf('- Cidade: %s', (string) ($interview->city ?? '-')),
                sprintf('- RH status: %s', (string) ($interview->hr_status ?? '-')),
                sprintf('- GUEP status: %s', (string) ($interview->guep_status ?? '-')),
                sprintf('- Nota geral: %s', number_format((float) ($interview->overall_score ?? 0), 1, ',', '.')),
                sprintf('- Cadastro: %s', optional($interview->created_at)?->format('d/m/Y H:i') ?? '-'),
            ]),
            'intent' => 'interview_lookup',
        ]);
    }

    private function resolveVacationStatusByDays(int $daysSinceBase): string
    {
        if ($daysSinceBase <= 365) {
            return 'a_vencer';
        }

        if ($daysSinceBase <= 576) {
            return 'liberada';
        }

        if ($daysSinceBase <= 636) {
            return 'atencao';
        }

        if ($daysSinceBase <= 699) {
            return 'urgente';
        }

        return 'vencida';
    }

    private function helpMessage(): string
    {
        return "Sou o Bob e consigo operar módulos do sistema por linguagem natural.\n\nComandos úteis:\n- ver dados do colaborador Adair\n- quanto Adair recebeu de adiantamento em março 2026\n- lancar pagamento colaborador Adair tipo Salário valor 3500 competencia 03/2026 data 25/03/2026\n- fretes do dia 01/03/2026\n- resumo fretes março 2026 unidade Amparo\n- resumo pagamentos março 2026\n- quando vai vencer as ferias do Adair\n- resumo entrevistas\n- entrevista de João Silva\n- visao geral do sistema";
    }

    private function extractPaymentType(string $message): ?TipoPagamento
    {
        $normalized = $this->normalizeText($message);

        $types = TipoPagamento::query()->get(['id', 'nome']);

        foreach ($types as $type) {
            $typeName = $this->normalizeText((string) $type->nome);
            if ($typeName !== '' && str_contains($normalized, $typeName)) {
                return $type;
            }
        }

        if (str_contains($normalized, 'adiantamento')) {
            return TipoPagamento::query()
                ->whereRaw('LOWER(nome) like ?', ['%adiant%'])
                ->first(['id', 'nome']);
        }

        if (str_contains($normalized, 'salario') || str_contains($normalized, 'salário')) {
            return TipoPagamento::query()
                ->whereRaw('LOWER(nome) like ?', ['%sal%'])
                ->first(['id', 'nome']);
        }

        return null;
    }

    private function persistConversationAndRespond(Request $request, string $userMessage, JsonResponse $response): JsonResponse
    {
        try {
            $data = $response->getData(true);
            $reply = trim((string) ($data['reply'] ?? ''));
            $intent = trim((string) ($data['intent'] ?? '')) ?: null;

            if ($reply !== '') {
                BobAssistantMessage::query()->create([
                    'user_id' => (int) $request->user()->id,
                    'role' => 'user',
                    'content' => $userMessage,
                    'intent' => null,
                    'metadata' => null,
                ]);

                BobAssistantMessage::query()->create([
                    'user_id' => (int) $request->user()->id,
                    'role' => 'assistant',
                    'content' => $reply,
                    'intent' => $intent,
                    'metadata' => null,
                ]);
            }
        } catch (Throwable) {
        }

        return $response;
    }

    private function normalizeText(string $value): string
    {
        return Str::of($value)
            ->lower()
            ->ascii()
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->value();
    }

    private function extractDate(string $message): ?Carbon
    {
        $normalized = $this->normalizeText($message);

        if (str_contains($normalized, 'hoje')) {
            return now();
        }

        if (str_contains($normalized, 'ontem')) {
            return now()->subDay();
        }

        if (preg_match('/\b(\d{2})\/(\d{2})\/(\d{4})\b/', $message, $match) === 1) {
            try {
                return Carbon::createFromFormat('d/m/Y', $match[0]);
            } catch (\Throwable) {
                return null;
            }
        }

        if (preg_match('/\b(\d{4})-(\d{2})-(\d{2})\b/', $message, $match) === 1) {
            try {
                return Carbon::createFromFormat('Y-m-d', $match[0]);
            } catch (\Throwable) {
                return null;
            }
        }

        return null;
    }

    private function extractMonthYear(string $message): array
    {
        if (preg_match('/\b(\d{1,2})\/(\d{4})\b/', $message, $match) === 1) {
            return [max(1, min(12, (int) $match[1])), (int) $match[2]];
        }

        if (preg_match('/\b(\d{4})-(\d{1,2})\b/', $message, $match) === 1) {
            return [max(1, min(12, (int) $match[2])), (int) $match[1]];
        }

        $normalized = $this->normalizeText($message);
        $monthMap = [
            'janeiro' => 1,
            'fevereiro' => 2,
            'marco' => 3,
            'abril' => 4,
            'maio' => 5,
            'junho' => 6,
            'julho' => 7,
            'agosto' => 8,
            'setembro' => 9,
            'outubro' => 10,
            'novembro' => 11,
            'dezembro' => 12,
        ];

        $month = now()->month;
        foreach ($monthMap as $label => $value) {
            if (str_contains($normalized, $label)) {
                $month = $value;
                break;
            }
        }

        $year = now()->year;
        if (preg_match('/\b(20\d{2})\b/', $normalized, $yearMatch) === 1) {
            $year = (int) $yearMatch[1];
        }

        return [$month, $year];
    }

    private function extractUnit(string $message): ?Unidade
    {
        $normalized = $this->normalizeText($message);
        $terms = collect(preg_split('/\s+/', $normalized) ?: [])
            ->filter(fn (string $term) => strlen($term) >= 3)
            ->values();

        if ($terms->isEmpty()) {
            return null;
        }

        $query = Unidade::query();
        foreach ($terms as $term) {
            $query->orWhereRaw('LOWER(nome) like ?', ['%'.$term.'%']);
        }

        return $query
            ->orderByRaw('LENGTH(nome) DESC')
            ->first(['id', 'nome']);
    }

    private function extractCollaborator(string $message): ?Colaborador
    {
        $normalized = $this->normalizeText($message);

        $terms = collect(preg_split('/\s+/', $normalized) ?: [])
            ->filter(fn (string $term) => strlen($term) >= 3)
            ->reject(fn (string $term) => in_array($term, ['colaborador', 'funcionario', 'funcionário', 'pagamento', 'pagamentos', 'ferias', 'férias', 'admissao', 'admissão', 'dados', 'quanto', 'ganhou', 'recebeu', 'adiantamento', 'salario', 'salário', 'do', 'da', 'de', 'em', 'no', 'na'], true))
            ->values();

        if ($terms->isEmpty()) {
            return null;
        }

        $query = Colaborador::query()->where('ativo', true);
        foreach ($terms as $term) {
            $query->whereRaw('LOWER(nome) like ?', ['%'.$term.'%']);
        }

        return $query
            ->orderByRaw('LENGTH(nome) DESC')
            ->first(['id', 'nome', 'data_admissao', 'unidade_id', 'funcao_id', 'cpf', 'ativo']);
    }

    private function extractNumberByKeywords(string $message, array $keywords): ?float
    {
        $normalized = $this->normalizeText($message);

        foreach ($keywords as $keyword) {
            $normalizedKeyword = $this->normalizeText($keyword);
            $pattern = '/'.preg_quote($normalizedKeyword, '/').'\s*[:=]?\s*([\d\.,]+)/i';

            if (preg_match($pattern, $normalized, $match) === 1) {
                return $this->parseLocalizedNumber((string) $match[1]);
            }
        }

        return null;
    }

    private function parseLocalizedNumber(string $value): float
    {
        $clean = preg_replace('/[^\d,\.]/', '', $value) ?? '0';

        if (str_contains($clean, ',') && str_contains($clean, '.')) {
            if (strrpos($clean, ',') > strrpos($clean, '.')) {
                $clean = str_replace('.', '', $clean);
                $clean = str_replace(',', '.', $clean);
            } else {
                $clean = str_replace(',', '', $clean);
            }
        } elseif (str_contains($clean, ',')) {
            $clean = str_replace('.', '', $clean);
            $clean = str_replace(',', '.', $clean);
        }

        return (float) $clean;
    }
}
