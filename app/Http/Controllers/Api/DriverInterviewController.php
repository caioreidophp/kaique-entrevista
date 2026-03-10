<?php

namespace App\Http\Controllers\Api;

use App\Enums\HrStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDriverInterviewRequest;
use App\Http\Requests\UpdateDriverInterviewRequest;
use App\Http\Requests\UpdateDriverInterviewStatusesRequest;
use App\Http\Resources\DriverInterviewListResource;
use App\Http\Resources\DriverInterviewResource;
use App\Models\DriverInterview;
use App\Support\PdfBranding;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class DriverInterviewController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', DriverInterview::class);

        $perPage = min(max((int) $request->integer('per_page', 15), 1), 100);

        $query = DriverInterview::query()
            ->select([
                'id',
                'author_id',
                'full_name',
                'hiring_unidade_id',
                'hr_status',
                'hr_rejection_reason',
                'guep_status',
                'created_at',
            ])
            ->with(['author:id,name,email', 'hiringUnidade:id,nome,slug'])
            ->latest('id');

        if ($request->filled('name')) {
            $name = (string) $request->string('name');
            $query->where('full_name', 'like', "%{$name}%");
        }

        if ($request->filled('status')) {
            $query->where('hr_status', (string) $request->string('status'));
        }

        if ($request->filled('author_id') && $request->user()->isMasterAdmin()) {
            $query->where('author_id', (int) $request->integer('author_id'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', (string) $request->string('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', (string) $request->string('date_to'));
        }

        return DriverInterviewListResource::collection(
            $query->paginate($perPage)->withQueryString(),
        );
    }

    public function store(StoreDriverInterviewRequest $request): DriverInterviewResource
    {
        $this->authorize('create', DriverInterview::class);

        $data = $request->validated();

        $data['guep_status'] = $data['hr_status'] === HrStatus::Reprovado->value
            ? 'nao_fazer'
            : 'aguardando';

        if ($data['hr_status'] === HrStatus::Reprovado->value && empty($data['hr_rejection_reason'])) {
            $data['hr_rejection_reason'] = 'Não informado';
        }

        $interview = DriverInterview::query()->create([
            ...$data,
            'user_id' => $request->user()->id,
            'author_id' => $request->user()->id,
        ]);

        return new DriverInterviewResource($interview->load(['author:id,name,email', 'hiringUnidade:id,nome,slug']));
    }

    public function show(DriverInterview $driverInterview): DriverInterviewResource
    {
        $this->authorize('view', $driverInterview);

        return new DriverInterviewResource($driverInterview->load(['author:id,name,email', 'hiringUnidade:id,nome,slug']));
    }

    public function update(UpdateDriverInterviewRequest $request, DriverInterview $driverInterview): DriverInterviewResource
    {
        $this->authorize('update', $driverInterview);

        $data = $request->validated();
        $nextHrStatus = (string) ($data['hr_status'] ?? $driverInterview->hr_status->value);

        if (array_key_exists('hr_rejection_reason', $data)) {
            $data['hr_rejection_reason'] = trim((string) $data['hr_rejection_reason']) ?: null;
        }

        if ($nextHrStatus === HrStatus::Reprovado->value) {
            $data['guep_status'] = 'nao_fazer';
            if (! ($data['hr_rejection_reason'] ?? null)) {
                $data['hr_rejection_reason'] = $driverInterview->hr_rejection_reason ?: 'Não informado';
            }
        } else {
            $data['hr_rejection_reason'] = null;
        }

        $driverInterview->update($data);

        return new DriverInterviewResource($driverInterview->refresh()->load(['author:id,name,email', 'hiringUnidade:id,nome,slug']));
    }

    public function updateStatuses(
        UpdateDriverInterviewStatusesRequest $request,
        DriverInterview $driverInterview
    ): DriverInterviewResource {
        $this->authorize('update', $driverInterview);

        $data = $request->validated();
        $nextHrStatus = (string) ($data['hr_status'] ?? $driverInterview->hr_status->value);

        if (array_key_exists('hr_rejection_reason', $data)) {
            $data['hr_rejection_reason'] = trim((string) $data['hr_rejection_reason']) ?: null;
        }

        if ($nextHrStatus === HrStatus::Reprovado->value) {
            $data['guep_status'] = 'nao_fazer';
            if (! ($data['hr_rejection_reason'] ?? null)) {
                $data['hr_rejection_reason'] = $driverInterview->hr_rejection_reason ?: 'Não informado';
            }
        } else {
            $data['hr_rejection_reason'] = null;
        }

        $driverInterview->update($data);

        return new DriverInterviewResource($driverInterview->refresh()->load(['author:id,name,email', 'hiringUnidade:id,nome,slug']));
    }

    public function destroy(DriverInterview $driverInterview): Response
    {
        $this->authorize('delete', $driverInterview);

        $driverInterview->delete();

        return response()->noContent();
    }

    public function pdf(DriverInterview $driverInterview): Response
    {
        $this->authorize('print', $driverInterview);

        $pdf = Pdf::loadView('pdf.driver-interview', [
            'interview' => $driverInterview->load('author:id,name,email'),
            'logoDataUri' => PdfBranding::logoDataUri(),
        ]);

        return response(
            $pdf->output(),
            200,
            [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'inline; filename="entrevista-'.$driverInterview->id.'.pdf"',
            ],
        );
    }
}
