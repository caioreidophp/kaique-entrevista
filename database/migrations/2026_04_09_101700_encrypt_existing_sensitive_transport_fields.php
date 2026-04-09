<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('colaboradores')
            ->select(['id', 'cpf', 'rg', 'cnh'])
            ->orderBy('id')
            ->chunkById(200, function ($rows): void {
                foreach ($rows as $row) {
                    $updates = [];

                    $cpfPayload = $this->extractValue((string) ($row->cpf ?? ''));
                    $cpfNormalized = preg_replace('/\D+/', '', (string) ($cpfPayload['value'] ?? '')) ?: null;

                    $updates['cpf_hash'] = $cpfNormalized ? hash('sha256', $cpfNormalized) : null;

                    if ($cpfNormalized === null) {
                        $updates['cpf'] = null;
                    } elseif (! $cpfPayload['encrypted'] || (string) $cpfPayload['value'] !== $cpfNormalized) {
                        $updates['cpf'] = Crypt::encryptString($cpfNormalized);
                    }

                    foreach (['rg', 'cnh'] as $column) {
                        $payload = $this->extractValue((string) ($row->{$column} ?? ''));

                        if ($payload['value'] === null) {
                            if ((string) ($row->{$column} ?? '') !== '') {
                                $updates[$column] = null;
                            }

                            continue;
                        }

                        if (! $payload['encrypted']) {
                            $updates[$column] = Crypt::encryptString((string) $payload['value']);
                        }
                    }

                    if ($updates === []) {
                        continue;
                    }

                    DB::table('colaboradores')
                        ->where('id', (int) $row->id)
                        ->update($updates);
                }
            }, 'id');

        DB::table('driver_interviews')
            ->select(['id', 'cpf', 'rg', 'cnh_number'])
            ->orderBy('id')
            ->chunkById(200, function ($rows): void {
                foreach ($rows as $row) {
                    $updates = [];

                    foreach (['cpf', 'rg', 'cnh_number'] as $column) {
                        $payload = $this->extractValue((string) ($row->{$column} ?? ''));

                        if ($payload['value'] === null) {
                            if ((string) ($row->{$column} ?? '') !== '') {
                                $updates[$column] = null;
                            }

                            continue;
                        }

                        if (! $payload['encrypted']) {
                            $normalized = $column === 'cpf'
                                ? (preg_replace('/\D+/', '', (string) $payload['value']) ?: null)
                                : (string) $payload['value'];

                            if ($normalized === null || $normalized === '') {
                                $updates[$column] = null;
                            } else {
                                $updates[$column] = Crypt::encryptString($normalized);
                            }
                        }
                    }

                    if ($updates === []) {
                        continue;
                    }

                    DB::table('driver_interviews')
                        ->where('id', (int) $row->id)
                        ->update($updates);
                }
            }, 'id');
    }

    public function down(): void
    {
        // Intentionally no-op: do not decrypt sensitive data on rollback.
    }

    /**
     * @return array{value: string|null, encrypted: bool}
     */
    private function extractValue(string $value): array
    {
        $trimmed = trim($value);

        if ($trimmed === '') {
            return ['value' => null, 'encrypted' => false];
        }

        try {
            return [
                'value' => (string) Crypt::decryptString($trimmed),
                'encrypted' => true,
            ];
        } catch (\Throwable) {
            return [
                'value' => $trimmed,
                'encrypted' => false,
            ];
        }
    }
};
