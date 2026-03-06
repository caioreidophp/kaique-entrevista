<?php

namespace App\Support;

class PdfBranding
{
    public static function logoDataUri(): ?string
    {
        if (! extension_loaded('gd')) {
            return null;
        }

        $logoPath = base_path('logo/logokaique.png');

        if (! is_file($logoPath)) {
            return null;
        }

        $binary = file_get_contents($logoPath);

        if ($binary === false) {
            return null;
        }

        return 'data:image/png;base64,'.base64_encode($binary);
    }
}
