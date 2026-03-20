<?php

namespace App\Http\Controllers\Api\Registry;

use App\Http\Controllers\Controller;
use App\Support\RolePermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class RolePermissionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $roles = ['master_admin', 'admin', 'usuario'];
        $permissionsByRole = [];

        foreach ($roles as $role) {
            $permissionsByRole[$role] = RolePermissionCatalog::forRole($role);
        }

        return response()->json([
            'roles' => $roles,
            'sections' => RolePermissionCatalog::sections(),
            'permissions_by_role' => $permissionsByRole,
        ]);
    }

    public function update(Request $request, string $role): JsonResponse
    {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $data = $request->validate([
            'permissions' => ['required', 'array'],
        ]);

        abort_unless(in_array($role, ['master_admin', 'admin', 'usuario'], true), 422);

        $saved = RolePermissionCatalog::saveForRole($role, (array) $data['permissions']);

        if (! Cache::has('transport:permissions-version')) {
            Cache::put('transport:permissions-version', 1, now()->addDays(7));
        }

        Cache::increment('transport:permissions-version');

        return response()->json([
            'role' => $role,
            'permissions' => $saved,
        ]);
    }
}
