<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\MasterDataConsistencyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SystemMasterDataController extends Controller
{
    public function consistency(Request $request, MasterDataConsistencyService $service): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        return response()->json($service->snapshot());
    }
}
