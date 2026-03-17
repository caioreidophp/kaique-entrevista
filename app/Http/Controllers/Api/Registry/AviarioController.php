<?php

namespace App\Http\Controllers\Api\Registry;

use App\Http\Controllers\Controller;
use App\Http\Requests\ImportAviariosSpreadsheetRequest;
use App\Http\Requests\StoreAviarioRequest;
use App\Http\Requests\UpdateAviarioRequest;
use App\Models\Aviario;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use PhpOffice\PhpSpreadsheet\IOFactory;

class AviarioController extends Controller
{
    private const INDEX_CACHE_KEY = 'transport:registry:aviarios:index';

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $user?->isAdmin() || $user?->isMasterAdmin() || $user?->isUsuario(),
            403,
        );

        return response()->json([
            'data' => Cache::remember(
                self::INDEX_CACHE_KEY,
                now()->addMinutes(10),
                fn () => Aviario::query()
                    ->select(['id', 'nome', 'cidade', 'km'])
                    ->orderBy('nome')
                    ->orderBy('cidade')
                    ->get(),
            ),
        ]);
    }

    public function store(StoreAviarioRequest $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $aviario = Aviario::query()->create($request->validated());

        Cache::forget(self::INDEX_CACHE_KEY);

        return response()->json(['data' => $aviario], 201);
    }

    public function bulkStore(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $validated = Validator::make($request->all(), [
            'cidade' => ['required', 'string', 'max:255'],
            'aviarios' => ['required', 'string'],
        ])->validate();

        $cidade = trim((string) $validated['cidade']);

        $rawNames = preg_split('/[\r\n,;]+/', (string) $validated['aviarios']) ?: [];

        $normalized = collect($rawNames)
            ->map(fn (string $value): string => trim($value))
            ->filter(fn (string $name): bool => $name !== '')
            ->unique()
            ->values();

        if ($normalized->isEmpty()) {
            return response()->json([
                'created_count' => 0,
                'skipped_existing' => [],
            ]);
        }

        $existing = Aviario::query()
            ->where('cidade', $cidade)
            ->whereIn('nome', $normalized->all())
            ->pluck('nome')
            ->all();

        $toCreate = $normalized->reject(fn (string $name): bool => in_array($name, $existing, true));

        DB::transaction(function () use ($toCreate, $cidade): void {
            foreach ($toCreate as $name) {
                Aviario::query()->create([
                    'nome' => $name,
                    'cidade' => $cidade,
                    'km' => null,
                ]);
            }
        });

        Cache::forget(self::INDEX_CACHE_KEY);

        return response()->json([
            'created_count' => $toCreate->count(),
            'skipped_existing' => array_values($existing),
        ], 201);
    }

    public function importSpreadsheet(ImportAviariosSpreadsheetRequest $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $uploaded = $request->file('file');

        if (! $uploaded) {
            return response()->json(['message' => 'Arquivo não encontrado.'], 422);
        }

        $path = $uploaded->getRealPath() ?: '';

        if ($path === '' || ! is_file($path)) {
            return response()->json(['message' => 'Arquivo de importação inválido.'], 422);
        }

        try {
            $spreadsheet = IOFactory::load($path);
        } catch (\Throwable $exception) {
            $message = $exception->getMessage();

            Log::error('Falha ao importar XLSX de aviários', [
                'exception_class' => $exception::class,
                'message' => $message,
                'file_name' => $uploaded->getClientOriginalName(),
                'mime_type' => $uploaded->getClientMimeType(),
            ]);

            if (Str::contains($message, ['Class "ZipArchive" not found', 'Class ZipArchive not found'])) {
                return response()->json([
                    'message' => 'A extensão ZIP do PHP não está disponível no runtime da aplicação web. Ative "extension=zip" e reinicie o Apache/PHP.',
                ], 500);
            }

            return response()->json([
                'message' => 'Não foi possível ler o arquivo XLSX. Verifique se o arquivo está íntegro e no formato .xlsx.',
            ], 422);
        }

        $sheet = $spreadsheet->getActiveSheet();
        $highestDataRow = (int) $sheet->getHighestDataRow();

        if ($highestDataRow < 1) {
            return response()->json([
                'message' => 'A planilha não possui dados.',
            ], 422);
        }

        $seenPairs = [];
        $created = 0;
        $skipped = 0;
        $totalRead = 0;
        $errors = [];

        DB::beginTransaction();

        try {
            for ($line = 1; $line <= $highestDataRow; $line++) {
                $nome = trim((string) $sheet->getCell("A{$line}")->getFormattedValue());
                $cidade = trim((string) $sheet->getCell("B{$line}")->getFormattedValue());
                $kmRaw = trim((string) $sheet->getCell("C{$line}")->getFormattedValue());

                if ($nome === '' && $cidade === '' && $kmRaw === '') {
                    continue;
                }

                if ($line === 1
                    && Str::lower($nome) === 'nome'
                    && Str::lower($cidade) === 'cidade') {
                    continue;
                }

                $totalRead++;

                if ($nome === '' || $cidade === '') {
                    $skipped++;
                    $errors[] = [
                        'linha' => $line,
                        'tipo' => 'campos_obrigatorios',
                        'erro' => 'Nome e cidade são obrigatórios.',
                    ];
                    continue;
                }

                $km = null;
                if ($kmRaw !== '') {
                    $normalizedKm = str_replace(' ', '', $kmRaw);

                    if (str_contains($normalizedKm, ',')) {
                        $normalizedKm = str_replace('.', '', $normalizedKm);
                        $normalizedKm = str_replace(',', '.', $normalizedKm);
                    }

                    if (! is_numeric($normalizedKm)) {
                        $skipped++;
                        $errors[] = [
                            'linha' => $line,
                            'tipo' => 'km_invalido',
                            'erro' => 'KM inválido.',
                            'km' => $kmRaw,
                        ];
                        continue;
                    }

                    $km = (float) $normalizedKm;
                    if ($km < 0) {
                        $skipped++;
                        $errors[] = [
                            'linha' => $line,
                            'tipo' => 'km_negativo',
                            'erro' => 'KM não pode ser negativo.',
                            'km' => $kmRaw,
                        ];
                        continue;
                    }
                }

                $pairKey = Str::lower($nome).'|'.Str::lower($cidade);
                if (isset($seenPairs[$pairKey])) {
                    $skipped++;
                    $errors[] = [
                        'linha' => $line,
                        'tipo' => 'duplicado_planilha',
                        'erro' => 'Aviário duplicado na planilha (nome + cidade).',
                    ];
                    continue;
                }

                $seenPairs[$pairKey] = true;

                $alreadyExists = Aviario::query()
                    ->where('nome', $nome)
                    ->where('cidade', $cidade)
                    ->exists();

                if ($alreadyExists) {
                    $skipped++;
                    $errors[] = [
                        'linha' => $line,
                        'tipo' => 'duplicado_sistema',
                        'erro' => 'Aviário já existe no sistema (nome + cidade).',
                    ];
                    continue;
                }

                Aviario::query()->create([
                    'nome' => $nome,
                    'cidade' => $cidade,
                    'km' => $km,
                ]);

                $created++;
            }

            DB::commit();
        } catch (\Throwable $exception) {
            DB::rollBack();
            throw $exception;
        }

        Cache::forget(self::INDEX_CACHE_KEY);

        return response()->json([
            'total_lidos' => $totalRead,
            'total_importados' => $created,
            'total_ignorados' => $skipped,
            'erros' => $errors,
        ], 201);
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);
        abort_unless((bool) config('transport_features.csv_exports', true), 404);

        $fileName = 'aviarios-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function (): void {
            $handle = fopen('php://output', 'w');

            if (! $handle) {
                return;
            }

            fprintf($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['id', 'nome', 'cidade', 'km'], ';');

            Aviario::query()
                ->select(['id', 'nome', 'cidade', 'km'])
                ->orderBy('nome')
                ->orderBy('cidade')
                ->chunk(500, function ($rows) use ($handle): void {
                    foreach ($rows as $row) {
                        fputcsv($handle, [
                            $row->id,
                            $row->nome,
                            $row->cidade,
                            $row->km !== null ? (string) ((int) round((float) $row->km)) : '',
                        ], ';');
                    }
                });

            fclose($handle);
        }, $fileName, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function update(UpdateAviarioRequest $request, Aviario $aviario): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $aviario->update($request->validated());

        Cache::forget(self::INDEX_CACHE_KEY);

        return response()->json(['data' => $aviario->refresh()]);
    }

    public function destroy(Request $request, Aviario $aviario): JsonResponse
    {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $aviario->delete();

        Cache::forget(self::INDEX_CACHE_KEY);

        return response()->json([], 204);
    }
}
