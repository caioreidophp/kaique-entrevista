<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;

class FileSignatureInspector
{
    /**
     * @param  array<int, string>  $allowedKinds
     */
    public static function matchesAllowedKinds(UploadedFile $file, array $allowedKinds): bool
    {
        $detectedKind = self::detectKind($file);

        return $detectedKind !== null && in_array($detectedKind, $allowedKinds, true);
    }

    public static function detectKind(UploadedFile $file): ?string
    {
        $path = $file->getRealPath();

        if (! is_string($path) || $path === '' || ! is_file($path)) {
            return null;
        }

        $handle = @fopen($path, 'rb');

        if (! is_resource($handle)) {
            return null;
        }

        $header = fread($handle, 32) ?: '';
        fclose($handle);

        if (str_starts_with($header, '%PDF-')) {
            return 'pdf';
        }

        if (str_starts_with($header, "\xFF\xD8\xFF")) {
            return 'jpeg';
        }

        if (str_starts_with($header, "\x89PNG\x0D\x0A\x1A\x0A")) {
            return 'png';
        }

        if (str_starts_with($header, 'RIFF') && substr($header, 8, 4) === 'WEBP') {
            return 'webp';
        }

        if (str_starts_with($header, "\xD0\xCF\x11\xE0")) {
            return 'doc';
        }

        if (str_starts_with($header, "PK\x03\x04")) {
            return 'zip';
        }

        return null;
    }
}
