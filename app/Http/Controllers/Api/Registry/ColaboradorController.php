<?php

namespace App\Http\Controllers\Api\Registry;

use App\Http\Controllers\Controller;
use App\Http\Requests\ImportColaboradoresSpreadsheetRequest;
use App\Http\Requests\StoreColaboradorRequest;
use App\Http\Requests\UpdateColaboradorAttachmentsRequest;
use App\Http\Requests\UpdateColaboradorRequest;
use App\Http\Requests\UploadColaboradorPhotoRequest;
use App\Models\Colaborador;
use App\Models\Funcao;
use App\Models\Unidade;
use App\Support\TransportCache;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as SpreadsheetDate;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ColaboradorController extends Controller
{
    public function birthdays(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->hasPermission('registry.collaborators.list'), 403);

        $today = Carbon::today();
        $month = (int) $today->month;
        $day = (int) $today->day;
        $driver = DB::connection()->getDriverName();

        $todayRows = Colaborador::query()
            ->with(['unidade:id,nome', 'funcao:id,nome'])
            ->where('ativo', true)
            ->whereNotNull('data_nascimento')
            ->whereMonth('data_nascimento', $month)
            ->whereDay('data_nascimento', $day)
            ->orderBy('nome')
            ->get(['id', 'nome', 'data_nascimento', 'unidade_id', 'funcao_id']);

        if ($user && $user->dataScopeFor('registry') === 'units') {
            $allowedUnitIds = $user->allowedUnitIdsFor('registry');
            $todayRows = $todayRows->whereIn('unidade_id', $allowedUnitIds)->values();
        }

        $monthRows = Colaborador::query()
            ->with(['unidade:id,nome', 'funcao:id,nome'])
            ->where('ativo', true)
            ->whereNotNull('data_nascimento')
            ->whereMonth('data_nascimento', $month)
            ->orderByRaw(
                $driver === 'sqlite'
                    ? "cast(strftime('%d', data_nascimento) as integer) asc"
                    : 'DAY(data_nascimento) asc'
            )
            ->orderBy('nome')
            ->get(['id', 'nome', 'data_nascimento', 'unidade_id', 'funcao_id']);

        if ($user && $user->dataScopeFor('registry') === 'units') {
            $allowedUnitIds = $user->allowedUnitIdsFor('registry');
            $monthRows = $monthRows->whereIn('unidade_id', $allowedUnitIds)->values();
        }

        return response()->json([
            'today' => $today->toDateString(),
            'today_birthdays' => $todayRows,
            'month_birthdays' => $monthRows,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->hasPermission('registry.collaborators.list'), 403);

        $perPage = min(max((int) $request->integer('per_page', 15), 1), 100);

        $query = Colaborador::query()
            ->select('colaboradores.*')
            ->with(['unidade:id,nome,slug', 'funcao:id,nome', 'user:id,name,email']);

        if ($user && $user->dataScopeFor('registry') === 'units') {
            $allowedUnitIds = $user->allowedUnitIdsFor('registry');
            $query->whereIn('unidade_id', $allowedUnitIds !== [] ? $allowedUnitIds : [0]);
        }

        if ($request->filled('name')) {
            $query->where('nome', 'like', '%'.(string) $request->string('name').'%');
        }

        if ($request->filled('cpf')) {
            $cpf = preg_replace('/\D+/', '', (string) $request->string('cpf'));
            $query->where('cpf_hash', $cpf !== '' ? hash('sha256', $cpf) : null);
        }

        if ($request->filled('unidade_id')) {
            $query->where('unidade_id', (int) $request->integer('unidade_id'));
        }

        if ($request->filled('active')) {
            $query->where('ativo', $request->boolean('active'));
        }

        $sortBy = (string) $request->string('sort_by', 'id');
        $sortDirection = (string) $request->string('sort_direction', 'desc');
        $sortDirection = $sortDirection === 'asc' ? 'asc' : 'desc';

        if ($sortBy === 'funcao') {
            $query
                ->leftJoin('funcoes', 'funcoes.id', '=', 'colaboradores.funcao_id')
                ->orderBy('funcoes.nome', $sortDirection)
                ->orderBy('colaboradores.id', 'desc');
        } elseif ($sortBy === 'unidade') {
            $query
                ->leftJoin('unidades', 'unidades.id', '=', 'colaboradores.unidade_id')
                ->orderBy('unidades.nome', $sortDirection)
                ->orderBy('colaboradores.id', 'desc');
        } elseif (in_array($sortBy, ['nome', 'cpf', 'ativo', 'id'], true)) {
            $column = match ($sortBy) {
                'id' => 'colaboradores.id',
                'cpf' => 'colaboradores.cpf_hash',
                default => "colaboradores.{$sortBy}",
            };
            $query->orderBy($column, $sortDirection);

            if ($sortBy !== 'id') {
                $query->orderBy('colaboradores.id', 'desc');
            }
        }

        $canUseCache = (bool) config('transport_features.collaborator_index_cache', true)
            && ! $request->filled('name')
            && ! $request->filled('cpf')
            && ! $request->filled('unidade_id')
            && ! $request->filled('active')
            && $sortBy === 'id'
            && $sortDirection === 'desc'
            && $perPage === 15
            && (int) $request->integer('page', 1) === 1;

        if (! $canUseCache) {
            return response()->json($query->paginate($perPage)->withQueryString());
        }

        $payload = TransportCache::remember('registry', [
            'resource' => 'colaboradores-index',
            'user_id' => (int) $user->id,
            'scope' => $user->resolvedAccessScopes(),
            'page' => (int) $request->integer('page', 1),
            'per_page' => $perPage,
            'sort_by' => $sortBy,
            'sort_direction' => $sortDirection,
        ], now()->addSeconds(45), fn () => $query->paginate($perPage)->withQueryString());

        return response()->json($payload);
    }

    public function store(StoreColaboradorRequest $request): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('registry.collaborators.create'), 403);
        abort_unless($request->user()?->canAccessUnit('registry', (int) $request->integer('unidade_id')), 403);

        $colaborador = Colaborador::query()->create($request->validated());

        return response()->json([
            'data' => $colaborador->load(['unidade:id,nome,slug', 'funcao:id,nome', 'user:id,name,email']),
        ], 201);
    }

    public function show(Request $request, Colaborador $colaborador): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('registry.collaborators.list'), 403);
        abort_unless($request->user()?->canAccessUnit('registry', (int) $colaborador->unidade_id), 403);

        return response()->json([
            'data' => $colaborador->load(['unidade:id,nome,slug', 'funcao:id,nome', 'user:id,name,email']),
        ]);
    }

    public function update(UpdateColaboradorRequest $request, Colaborador $colaborador): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('registry.collaborators.update'), 403);
        abort_unless($request->user()?->canAccessUnit('registry', (int) $colaborador->unidade_id), 403);
        abort_unless($request->user()?->canAccessUnit('registry', (int) $request->integer('unidade_id')), 403);

        $colaborador->update($request->validated());

        return response()->json([
            'data' => $colaborador->refresh()->load(['unidade:id,nome,slug', 'funcao:id,nome', 'user:id,name,email']),
        ]);
    }

    public function destroy(Request $request, Colaborador $colaborador): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('registry.collaborators.delete'), 403);
        abort_unless($request->user()?->canAccessUnit('registry', (int) $colaborador->unidade_id), 403);

        $colaborador->delete();

        return response()->json([], 204);
    }

    public function uploadPhoto(UploadColaboradorPhotoRequest $request, Colaborador $colaborador): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('registry.collaborators.update'), 403);
        abort_unless($request->user()?->canAccessUnit('registry', (int) $colaborador->unidade_id), 403);

        $file = $request->file('foto');

        if (! $file) {
            return response()->json(['message' => 'Foto 3x4 não enviada.'], 422);
        }

        if ($colaborador->foto_3x4_path) {
            Storage::disk('public')->delete($colaborador->foto_3x4_path);
        }

        $path = $file->store("colaboradores/{$colaborador->id}/foto-3x4", 'public');

        $colaborador->update([
            'foto_3x4_path' => $path,
        ]);

        return response()->json([
            'data' => $colaborador->refresh()->load(['unidade:id,nome,slug', 'funcao:id,nome', 'user:id,name,email']),
        ]);
    }

    public function updateAttachments(
        UpdateColaboradorAttachmentsRequest $request,
        Colaborador $colaborador,
    ): JsonResponse {
        abort_unless($request->user()?->hasPermission('registry.collaborators.update'), 403);
        abort_unless($request->user()?->canAccessUnit('registry', (int) $colaborador->unidade_id), 403);

        $validated = $request->validated();
        $updates = [];

        if ((bool) ($validated['remove_cnh_attachment'] ?? false)) {
            $this->clearAttachment($colaborador, 'cnh_attachment_path', 'cnh_attachment_original_name');
            $updates['cnh_attachment_path'] = null;
            $updates['cnh_attachment_original_name'] = null;
        }

        if ((bool) ($validated['remove_work_card_attachment'] ?? false)) {
            $this->clearAttachment($colaborador, 'work_card_attachment_path', 'work_card_attachment_original_name');
            $updates['work_card_attachment_path'] = null;
            $updates['work_card_attachment_original_name'] = null;
        }

        $cnhAttachment = $request->file('cnh_attachment_file');

        if ($cnhAttachment instanceof UploadedFile) {
            $stored = $this->replaceAttachment(
                $colaborador,
                $cnhAttachment,
                'cnh_attachment_path',
                'cnh',
            );

            $updates['cnh_attachment_path'] = $stored;
            $updates['cnh_attachment_original_name'] = $cnhAttachment->getClientOriginalName();
        }

        $workCardAttachment = $request->file('work_card_attachment_file');

        if ($workCardAttachment instanceof UploadedFile) {
            $stored = $this->replaceAttachment(
                $colaborador,
                $workCardAttachment,
                'work_card_attachment_path',
                'work-card',
            );

            $updates['work_card_attachment_path'] = $stored;
            $updates['work_card_attachment_original_name'] = $workCardAttachment->getClientOriginalName();
        }

        if ($updates !== []) {
            $colaborador->update($updates);
        }

        return response()->json([
            'data' => $colaborador->refresh()->load(['unidade:id,nome,slug', 'funcao:id,nome', 'user:id,name,email']),
        ]);
    }

    public function importSpreadsheet(ImportColaboradoresSpreadsheetRequest $request): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('registry.collaborators.import'), 403);

        $uploaded = $request->file('file');

        if (! $uploaded) {
            return response()->json(['message' => 'Arquivo não encontrado.'], 422);
        }

        $funcoesByNormalized = Funcao::query()->get()
            ->keyBy(fn (Funcao $funcao): string => $this->normalizeText((string) $funcao->nome));

        $unidadesByNormalized = Unidade::query()->get()
            ->keyBy(fn (Unidade $unidade): string => $this->normalizeText((string) $unidade->nome));

        $path = $uploaded->getRealPath() ?: '';

        if ($path === '' || ! is_file($path)) {
            return response()->json(['message' => 'Arquivo de importação inválido.'], 422);
        }

        try {
            $spreadsheet = IOFactory::load($path);
        } catch (\Throwable $exception) {
            $message = $exception->getMessage();
            $lowerMessage = Str::lower($message);

            Log::error('Falha ao importar XLSX de colaboradores', [
                'exception_class' => $exception::class,
                'message' => $message,
                'file_name' => $uploaded->getClientOriginalName(),
                'mime_type' => $uploaded->getClientMimeType(),
            ]);

            if (Str::contains($message, ['Class "ZipArchive" not found', 'Class ZipArchive not found'])) {
                $payload = [
                    'message' => 'A extensão ZIP do PHP não está disponível no runtime da aplicação web. Ative "extension=zip" e reinicie o Apache/PHP.',
                ];

                if (app()->isLocal()) {
                    $payload['detalhe'] = $message;
                }

                return response()->json($payload, 500);
            }

            if (Str::contains($lowerMessage, ['ziparchive::open', 'invalid or uninitialized zip object', 'could not find zip member'])) {
                $payload = [
                    'message' => 'Não foi possível abrir o arquivo como planilha XLSX válida. Verifique se o arquivo realmente é .xlsx e tente salvar novamente no Excel.',
                ];

                if (app()->isLocal()) {
                    $payload['detalhe'] = $message;
                }

                return response()->json($payload, 422);
            }

            $payload = [
                'message' => 'Não foi possível ler o arquivo XLSX. Verifique se o arquivo está íntegro e no formato .xlsx.',
            ];

            if (app()->isLocal()) {
                $payload['detalhe'] = $message;
            }

            return response()->json($payload, 422);
        }

        $sheet = $spreadsheet->getActiveSheet();
        $highestDataRow = (int) $sheet->getHighestDataRow();

        if ($highestDataRow < 5) {
            return response()->json([
                'message' => 'A planilha não possui dados suficientes a partir da linha 5.',
            ], 422);
        }

        $seenCpf = [];
        $imported = 0;
        $skipped = 0;
        $totalRead = 0;
        $errors = [];
        $rowsToInsert = [];

        for ($line = 5; $line <= $highestDataRow; $line++) {
            $nome = trim((string) $sheet->getCell("B{$line}")->getFormattedValue());
            $apelido = trim((string) $sheet->getCell("C{$line}")->getFormattedValue());
            $cargoRaw = trim((string) $sheet->getCell("D{$line}")->getFormattedValue());
            $telefoneRaw = trim((string) $sheet->getCell("E{$line}")->getFormattedValue());
            $email = trim((string) $sheet->getCell("F{$line}")->getFormattedValue());
            $dataNascimentoRaw = $sheet->getCell("G{$line}")->getValue();
            $dataNascimentoFormatted = (string) $sheet->getCell("G{$line}")->getFormattedValue();
            $cpfRaw = trim((string) $sheet->getCell("H{$line}")->getFormattedValue());
            $rgRaw = trim((string) $sheet->getCell("I{$line}")->getFormattedValue());
            $cnhRaw = trim((string) $sheet->getCell("J{$line}")->getFormattedValue());
            $validadeCnhRaw = $sheet->getCell("K{$line}")->getValue();
            $validadeCnhFormatted = (string) $sheet->getCell("K{$line}")->getFormattedValue();
            $dataAdmissaoRaw = $sheet->getCell("L{$line}")->getValue();
            $dataAdmissaoFormatted = (string) $sheet->getCell("L{$line}")->getFormattedValue();
            $unidadeRaw = trim((string) $sheet->getCell("O{$line}")->getFormattedValue());
            $statusRaw = trim((string) $sheet->getCell("P{$line}")->getFormattedValue());

            if ($this->isRowEffectivelyEmpty([$nome, $cpfRaw, $cargoRaw, $unidadeRaw, $statusRaw])) {
                continue;
            }

            $totalRead++;
            $cpf = preg_replace('/\D+/', '', $cpfRaw) ?: '';

            if ($nome === '' || $cpf === '') {
                $skipped++;
                $errors[] = [
                    'linha' => $line,
                    'tipo' => 'campos_obrigatorios',
                    'erro' => 'Nome e CPF são obrigatórios.',
                ];

                continue;
            }

            if (strlen($cpf) !== 11) {
                $skipped++;
                $errors[] = [
                    'linha' => $line,
                    'tipo' => 'cpf_invalido',
                    'erro' => 'CPF inválido. Deve conter 11 dígitos.',
                    'cpf' => $cpfRaw,
                ];

                continue;
            }

            if (isset($seenCpf[$cpf])) {
                $skipped++;
                $errors[] = [
                    'linha' => $line,
                    'tipo' => 'cpf_duplicado_planilha',
                    'erro' => 'CPF duplicado dentro da planilha.',
                    'cpf' => $cpf,
                ];

                continue;
            }

            if (Colaborador::query()->where('cpf_hash', hash('sha256', $cpf))->exists()) {
                $skipped++;
                $errors[] = [
                    'linha' => $line,
                    'tipo' => 'cpf_duplicado_sistema',
                    'erro' => 'CPF já cadastrado no sistema.',
                    'cpf' => $cpf,
                ];

                continue;
            }

            $seenCpf[$cpf] = true;

            $mappedCargo = $this->mapCargoName($cargoRaw);
            $funcao = $funcoesByNormalized->get($this->normalizeText($mappedCargo));

            if (! $funcao) {
                $skipped++;
                $errors[] = [
                    'linha' => $line,
                    'tipo' => 'funcao_nao_encontrada',
                    'erro' => 'Função não encontrada no sistema.',
                    'funcao' => $cargoRaw,
                ];

                continue;
            }

            $mappedUnidade = $this->mapUnidadeName($unidadeRaw);
            $unidade = $unidadesByNormalized->get($this->normalizeText($mappedUnidade));

            if (! $unidade) {
                $skipped++;
                $errors[] = [
                    'linha' => $line,
                    'tipo' => 'unidade_nao_encontrada',
                    'erro' => 'Unidade não encontrada no sistema.',
                    'unidade' => $unidadeRaw,
                ];

                continue;
            }

            $ativo = $this->parseActiveStatus($statusRaw);

            if ($ativo === null) {
                $skipped++;
                $errors[] = [
                    'linha' => $line,
                    'tipo' => 'status_invalido',
                    'erro' => 'Status inválido. Use Ativo ou Inativo.',
                    'status' => $statusRaw,
                ];

                continue;
            }

            $dataNascimento = $this->parseSpreadsheetDateValue(
                $dataNascimentoRaw,
                $dataNascimentoFormatted,
            );
            $validadeCnh = $this->parseSpreadsheetDateValue(
                $validadeCnhRaw,
                $validadeCnhFormatted,
            );
            $dataAdmissao = $this->parseSpreadsheetDateValue(
                $dataAdmissaoRaw,
                $dataAdmissaoFormatted,
            );

            $telefoneDigits = preg_replace('/\D+/', '', $telefoneRaw) ?: null;
            if ($telefoneDigits !== null && strlen($telefoneDigits) !== 11) {
                $telefoneDigits = null;
            }

            $rg = strtoupper(preg_replace('/[^0-9A-Za-z]+/', '', $rgRaw) ?: '');
            $rg = strlen($rg) === 10 ? $rg : null;

            $cnh = preg_replace('/\D+/', '', $cnhRaw) ?: '';
            $cnh = strlen($cnh) === 9 ? $cnh : null;

            $rowsToInsert[] = [
                'unidade_id' => $unidade->id,
                'funcao_id' => $funcao->id,
                'nome' => $nome,
                'apelido' => $apelido !== '' ? $apelido : null,
                'ativo' => $ativo,
                'cpf' => $cpf,
                'cpf_hash' => hash('sha256', $cpf),
                'rg' => $rg,
                'cnh' => $cnh,
                'validade_cnh' => $validadeCnh,
                'data_nascimento' => $dataNascimento,
                'data_admissao' => $dataAdmissao,
                'telefone' => $telefoneDigits,
                'email' => $email !== '' ? $email : null,
            ];
        }

        DB::transaction(function () use (&$imported, $rowsToInsert): void {
            foreach ($rowsToInsert as $payload) {
                Colaborador::query()->create($payload);
                $imported++;
            }
        });

        return response()->json([
            'message' => 'Importação finalizada.',
            'total_lidos' => $totalRead,
            'total_importados' => $imported,
            'total_ignorados' => $skipped,
            'erros' => $errors,
        ]);
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        abort_unless($request->user()?->hasPermission('registry.collaborators.export'), 403);
        abort_unless((bool) config('transport_features.csv_exports', true), 404);

        $name = trim((string) $request->string('name', ''));
        $unidadeId = (int) $request->integer('unidade_id', 0);
        $activeRaw = (string) $request->string('active', '');

        $query = Colaborador::query()
            ->with(['unidade:id,nome', 'funcao:id,nome'])
            ->orderBy('nome');

        if ($name !== '') {
            $query->where('nome', 'like', '%'.$name.'%');
        }

        if ($unidadeId > 0) {
            $query->where('unidade_id', $unidadeId);
        }

        if ($activeRaw !== '' && in_array($activeRaw, ['0', '1'], true)) {
            $query->where('ativo', $activeRaw === '1');
        }

        $fileName = 'colaboradores-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($query): void {
            $handle = fopen('php://output', 'w');

            if (! $handle) {
                return;
            }

            fprintf($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['id', 'nome', 'cpf', 'funcao', 'unidade', 'status'], ';');

            $query->chunk(300, function ($rows) use ($handle): void {
                foreach ($rows as $row) {
                    fputcsv($handle, [
                        $row->id,
                        $row->nome,
                        $row->cpf,
                        $row->funcao?->nome ?? '',
                        $row->unidade?->nome ?? '',
                        $row->ativo ? 'Ativo' : 'Inativo',
                    ], ';');
                }
            });

            fclose($handle);
        }, $fileName, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    /**
     * @param  array<int, string>  $values
     */
    private function isRowEffectivelyEmpty(array $values): bool
    {
        foreach ($values as $value) {
            if (trim($value) !== '') {
                return false;
            }
        }

        return true;
    }

    private function replaceAttachment(
        Colaborador $colaborador,
        UploadedFile $file,
        string $pathField,
        string $folder,
    ): string {
        $nameField = $pathField === 'cnh_attachment_path'
            ? 'cnh_attachment_original_name'
            : 'work_card_attachment_original_name';

        $this->clearAttachment($colaborador, $pathField, $nameField);

        return $file->store("colaboradores/{$colaborador->id}/{$folder}", 'public');
    }

    private function clearAttachment(Colaborador $colaborador, string $pathField, string $nameField): void
    {
        $currentPath = (string) ($colaborador->{$pathField} ?? '');

        if ($currentPath !== '') {
            Storage::disk('public')->delete($currentPath);
        }

        $colaborador->{$pathField} = null;
        $colaborador->{$nameField} = null;
    }

    private function parseSpreadsheetDateValue(mixed $rawValue, string $formattedValue): ?string
    {
        if ($rawValue === null && trim($formattedValue) === '') {
            return null;
        }

        if (is_numeric($rawValue)) {
            try {
                return SpreadsheetDate::excelToDateTimeObject((float) $rawValue)->format('Y-m-d');
            } catch (\Throwable) {
                return null;
            }
        }

        $value = trim($formattedValue !== '' ? $formattedValue : (string) $rawValue);

        if ($value === '') {
            return null;
        }

        $formats = ['d/m/Y', 'd-m-Y', 'Y-m-d'];

        foreach ($formats as $format) {
            try {
                return Carbon::createFromFormat($format, $value)->toDateString();
            } catch (\Throwable) {
                continue;
            }
        }

        return null;
    }

    private function parseActiveStatus(string $status): ?bool
    {
        $normalized = $this->normalizeText($status);

        if (in_array($normalized, ['ativo', '1', 'true', 'sim'], true)) {
            return true;
        }

        if (in_array($normalized, ['inativo', '0', 'false', 'nao', 'não'], true)) {
            return false;
        }

        return null;
    }

    private function mapCargoName(string $cargo): string
    {
        $normalized = $this->normalizeText($cargo);

        if (Str::contains($normalized, 'motorista')) {
            return 'Motorista';
        }

        if (Str::contains($normalized, 'gerente') && Str::contains($normalized, 'frota')) {
            return 'Gerente de Frota';
        }

        if (Str::contains($normalized, 'auxiliar') && Str::contains($normalized, 'administrativo')) {
            return 'Auxiliar Administrativo';
        }

        return trim($cargo);
    }

    private function mapUnidadeName(string $unidade): string
    {
        $normalized = $this->normalizeText($unidade);

        return match ($normalized) {
            'rodoviario bertolino' => 'Tatuí',
            'itape - kaique transportes' => 'Itapetininga',
            'amparo - kaique transportes' => 'Amparo',
            default => trim($unidade),
        };
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
}
