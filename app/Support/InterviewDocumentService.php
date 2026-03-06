<?php

namespace App\Support;

use App\Models\DriverInterview;
use Illuminate\Support\Str;
use InvalidArgumentException;

class InterviewDocumentService
{
    /**
     * @var array<string, array{label: string, view: string, prefix: string}>
     */
    private const DOCUMENTS = [
        'checklist' => [
            'label' => 'Checklist',
            'view' => 'pdf.documents.checklist',
            'prefix' => 'Checklist',
        ],
        'raca-etnia' => [
            'label' => 'Raça e Etnia',
            'view' => 'pdf.documents.race-ethnicity',
            'prefix' => 'RacaEtnia',
        ],
    ];

    /**
     * @return array<string, array{label: string, view: string, prefix: string}>
     */
    public function documents(): array
    {
        return self::DOCUMENTS;
    }

    public function documentView(string $document): string
    {
        return $this->documentConfig($document)['view'];
    }

    public function documentLabel(string $document): string
    {
        return $this->documentConfig($document)['label'];
    }

    public function fileName(string $document, DriverInterview $interview): string
    {
        $prefix = $this->documentConfig($document)['prefix'];
        $candidate = Str::of($interview->full_name)
            ->ascii()
            ->replaceMatches('/[^A-Za-z0-9]+/', '')
            ->trim()
            ->value();

        $candidate = $candidate !== '' ? $candidate : 'Candidato';

        return "{$prefix}-{$candidate}.pdf";
    }

    /**
     * @return array<string, mixed>
     */
    public function viewData(DriverInterview $interview, string $document, string $renderMode = 'pdf'): array
    {
        return [
            'interview' => $interview,
            'documentType' => $document,
            'documentTitle' => $this->documentLabel($document),
            'logoDataUri' => PdfBranding::logoDataUri(),
            'renderMode' => $renderMode,
            'generatedAt' => now(),
        ];
    }

    /**
     * @return array{label: string, view: string, prefix: string}
     */
    private function documentConfig(string $document): array
    {
        if (! array_key_exists($document, self::DOCUMENTS)) {
            throw new InvalidArgumentException('Documento inválido.');
        }

        return self::DOCUMENTS[$document];
    }
}
