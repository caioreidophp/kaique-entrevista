<?php

namespace App\Jobs;

use App\Models\AsyncExport;
use App\Models\FreightEntry;
use App\Models\User;
use App\Support\AsyncOperationTracker;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Throwable;

class GenerateFreightExportJob implements ShouldQueue
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

        $operation = AsyncOperationTracker::ensureForExport($export, 'Exportação de fretes em processamento');
        $export->update(['status' => 'processing', 'error_message' => null]);
        AsyncOperationTracker::markProcessing($operation->id, [
            'filters' => $export->filters ?? [],
        ]);

        try {
            $filters = (array) ($export->filters ?? []);

            $query = FreightEntry::query()
                ->select([
                    'id',
                    'data',
                    'unidade_id',
                    'autor_id',
                    'frete_total',
                    'frete_liquido',
                    'cargas',
                    'aves',
                    'veiculos',
                    'km_rodado',
                    'km_terceiros',
                    'frete_terceiros',
                    'viagens_terceiros',
                    'obs',
                ])
                ->with(['unidade:id,nome', 'autor:id,name'])
                ->latest('data')
                ->latest('id');

            if (! $user->isMasterAdmin()) {
                $query->where('autor_id', $user->id);
            }

            if (isset($filters['unidade_id'])) {
                $query->where('unidade_id', (int) $filters['unidade_id']);
            }

            if (isset($filters['start_date'])) {
                $query->whereDate('data', '>=', (string) $filters['start_date']);
            }

            if (isset($filters['end_date'])) {
                $query->whereDate('data', '<=', (string) $filters['end_date']);
            }

            $rows = $query->get();

            $spreadsheet = new Spreadsheet;
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('Fretes');
            $sheet->fromArray([
                'ID',
                'Data',
                'Unidade',
                'Frete Total',
                'Frete Líquido',
                'Cargas',
                'Aves',
                'Veículos',
                'KM Rodado',
                'KM Terceiros',
                'Frete Terceiros',
                'Viagens Terceiros',
                'Observações',
                'Autor',
            ], null, 'A1');

            $line = 2;
            foreach ($rows as $row) {
                $sheet->fromArray([
                    $row->id,
                    $row->data?->format('Y-m-d'),
                    $row->unidade?->nome,
                    (float) $row->frete_total,
                    (float) $row->frete_liquido,
                    (int) $row->cargas,
                    (int) $row->aves,
                    (int) $row->veiculos,
                    (float) $row->km_rodado,
                    (float) $row->km_terceiros,
                    (float) $row->frete_terceiros,
                    (int) $row->viagens_terceiros,
                    $row->obs,
                    $row->autor?->name,
                ], null, 'A'.$line);
                $line++;
            }

            $sheet->getStyle('D2:E'.$line)->getNumberFormat()->setFormatCode('#,##0.00');
            $sheet->getStyle('I2:K'.$line)->getNumberFormat()->setFormatCode('#,##0.00');
            foreach (range('A', 'N') as $column) {
                $sheet->getColumnDimension($column)->setAutoSize(true);
            }

            $fileName = sprintf('fretes_%s.xlsx', now()->format('Ymd_His'));
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
