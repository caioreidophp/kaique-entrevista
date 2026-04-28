<?php

namespace App\Jobs;

use App\Models\AsyncExport;
use App\Models\Pagamento;
use App\Models\TipoPagamento;
use App\Models\User;
use App\Support\AsyncOperationTracker;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Throwable;

class GeneratePayrollExportJob implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly string $asyncExportId)
    {
    }

    public function handle(): void
    {
        $export = AsyncExport::query()->find($this->asyncExportId);
        if (! $export) {
            return;
        }

        /** @var User|null $user */
        $user = User::query()->find($export->user_id);
        if (! $user) {
            $export->update(['status' => 'failed', 'error_message' => 'Usuário não encontrado']);
            return;
        }

        $operation = AsyncOperationTracker::ensureForExport($export, 'Exportação de pagamentos em processamento');
        $export->update(['status' => 'processing', 'error_message' => null]);
        AsyncOperationTracker::markProcessing($operation->id, [
            'filters' => $export->filters ?? [],
        ]);

        try {
            $filters = (array) ($export->filters ?? []);
            $mes = (int) ($filters['competencia_mes'] ?? now()->month);
            $ano = (int) ($filters['competencia_ano'] ?? now()->year);

            $query = Pagamento::query()
                ->select(['id', 'colaborador_id', 'tipo_pagamento_id', 'valor'])
                ->with(['colaborador:id,nome', 'tipoPagamento:id,nome'])
                ->where('competencia_mes', $mes)
                ->where('competencia_ano', $ano)
                ->latest('lancado_em')
                ->latest('id');

            if (! $user->isMasterAdmin()) {
                $query->where('autor_id', $user->id);
            }

            $rows = $query->get();
            $fallbackTypeNames = TipoPagamento::query()
                ->withoutGlobalScopes()
                ->whereIn(
                    'id',
                    $rows
                        ->pluck('tipo_pagamento_id')
                        ->filter(fn ($id) => $id !== null)
                        ->map(fn ($id) => (int) $id)
                        ->unique()
                        ->values()
                        ->all(),
                )
                ->pluck('nome', 'id');

            $grouped = [];

            foreach ($rows as $row) {
                $colaboradorId = (int) ($row->colaborador_id ?? 0);
                $name = trim((string) ($row->colaborador?->nome ?? 'Sem nome'));
                $key = $colaboradorId > 0 ? (string) $colaboradorId : $name;

                if (! isset($grouped[$key])) {
                    $grouped[$key] = [
                        'nome' => $name,
                        'vr' => 0.0,
                        'va' => 0.0,
                    ];
                }

                $typeName = (string) (
                    $row->tipoPagamento?->nome
                    ?? $fallbackTypeNames->get((int) ($row->tipo_pagamento_id ?? 0), '')
                );

                $normalizedType = str_replace(['á', 'ã', 'â', 'é', 'ê', 'í', 'ó', 'ô', 'õ', 'ú', 'ç'], ['a', 'a', 'a', 'e', 'e', 'i', 'o', 'o', 'o', 'u', 'c'], mb_strtolower($typeName));
                $value = (float) $row->valor;

                if (str_contains($normalizedType, 'vale refeicao') || str_contains($normalizedType, ' vr')) {
                    $grouped[$key]['vr'] += $value;
                    continue;
                }

                if (str_contains($normalizedType, 'premio media') || str_contains($normalizedType, 'cesta basica') || str_contains($normalizedType, ' va') || str_contains($normalizedType, ' cb')) {
                    $grouped[$key]['va'] += $value;
                }
            }

            $summaryRows = collect(array_values($grouped))
                ->sortBy('nome', SORT_NATURAL | SORT_FLAG_CASE)
                ->values();

            $totalVr = (float) $summaryRows->sum('vr');
            $totalVa = (float) $summaryRows->sum('va');

            $spreadsheet = new Spreadsheet;
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('Resumo VR VA');
            $sheet->setCellValue('A1', sprintf('Resumo VR/VA - %02d/%04d', $mes, $ano));
            $sheet->mergeCells('A1:C1');
            $sheet->fromArray(['Nome', 'VR', 'VA'], null, 'A3');

            $line = 4;
            foreach ($summaryRows as $row) {
                $sheet->fromArray([$row['nome'], (float) $row['vr'], (float) $row['va']], null, 'A'.$line);
                $line++;
            }

            $sheet->fromArray(['TOTAL', $totalVr, $totalVa], null, 'A'.$line);
            $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(13);
            $sheet->getStyle('A3:C3')->getFont()->setBold(true);
            $sheet->getStyle('A'.$line.':C'.$line)->getFont()->setBold(true);
            $sheet->getStyle('B4:C'.$line)->getNumberFormat()->setFormatCode('#,##0.00');
            foreach (range('A', 'C') as $column) {
                $sheet->getColumnDimension($column)->setAutoSize(true);
            }

            $fileName = sprintf('resumo_vr_va_%04d_%02d_%s.xlsx', $ano, $mes, now()->format('His'));
            $relativePath = 'exports/'.$fileName;
            $absolutePath = storage_path('app/'.$relativePath);

            $writer = new Xlsx($spreadsheet);
            $writer->save($absolutePath);
            $spreadsheet->disconnectWorksheets();
            unset($spreadsheet);

            $export->update([
                'status' => 'completed',
                'file_name' => $fileName,
                'file_path' => $relativePath,
                'completed_at' => now(),
            ]);
            AsyncOperationTracker::markCompleted($operation->id, [
                'file_name' => $fileName,
                'file_path' => $relativePath,
            ]);
        } catch (Throwable $exception) {
            $export->update([
                'status' => 'failed',
                'error_message' => mb_substr($exception->getMessage(), 0, 2000),
            ]);
            AsyncOperationTracker::markFailed($operation->id, $exception->getMessage(), [
                'filters' => $export->filters ?? [],
            ]);
        }
    }
}
