<div class="header">
    @if (!empty($logoDataUri))
        <img src="{{ $logoDataUri }}" alt="Kaique Transportes" />
    @elseif (($renderMode ?? 'pdf') === 'preview')
        <img src="/logo/logokaique.png" alt="Kaique Transportes" />
    @endif
</div>
