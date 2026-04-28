<?php

namespace Tests\Unit;

use App\Support\FileSignatureInspector;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class FileSignatureInspectorTest extends TestCase
{
    public function test_detects_known_binary_signatures(): void
    {
        $pdf = $this->fakeUploadWithContent('doc.pdf', "%PDF-1.4\nfake");
        $png = $this->fakeUploadWithContent('image.png', "\x89PNG\x0D\x0A\x1A\x0Arest");
        $webp = $this->fakeUploadWithContent('image.webp', 'RIFF1234WEBPrest');

        $this->assertSame('pdf', FileSignatureInspector::detectKind($pdf));
        $this->assertSame('png', FileSignatureInspector::detectKind($png));
        $this->assertSame('webp', FileSignatureInspector::detectKind($webp));
    }

    public function test_rejects_unknown_signatures_for_allowed_kinds(): void
    {
        $zipPayload = $this->fakeUploadWithContent('arquivo.pdf', "PK\x03\x04fake");

        $this->assertFalse(FileSignatureInspector::matchesAllowedKinds($zipPayload, ['pdf', 'jpeg', 'png']));
        $this->assertSame('zip', FileSignatureInspector::detectKind($zipPayload));
    }

    private function fakeUploadWithContent(string $name, string $content): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'sig-');
        file_put_contents($path, $content);

        return new UploadedFile(
            $path,
            $name,
            null,
            null,
            true,
        );
    }
}
