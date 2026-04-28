<?php

namespace App\Http\Controllers\Api\Registry;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreRegistryUserRequest;
use App\Http\Requests\UpdateRegistryUserRequest;
use App\Models\Colaborador;
use App\Models\User;
use App\Support\AccessScopeCatalog;
use App\Support\TransportCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RegistryUserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $users = User::query()
            ->with(['colaborador:id,nome,user_id', 'accessScopes'])
            ->latest('id')
            ->get();

        return response()->json([
            'modules' => AccessScopeCatalog::modules(),
            'data_scopes' => AccessScopeCatalog::dataScopes(),
            'data' => $users,
        ]);
    }

    public function store(StoreRegistryUserRequest $request): JsonResponse
    {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $data = $request->validated();

        $user = User::query()->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'role' => $data['role'],
        ]);

        Colaborador::query()
            ->where('user_id', $user->id)
            ->update(['user_id' => null]);

        if (! empty($data['colaborador_id'])) {
            Colaborador::query()
                ->whereKey((int) $data['colaborador_id'])
                ->update(['user_id' => $user->id]);
        }

        $this->syncAccessScopes($user, (array) ($data['access_scopes'] ?? []));
        TransportCache::bumpMany(['permissions', 'home']);

        return response()->json([
            'data' => $user->load(['colaborador:id,nome,user_id', 'accessScopes']),
        ], 201);
    }

    public function update(UpdateRegistryUserRequest $request, User $user): JsonResponse
    {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $data = $request->validated();

        $user->name = $data['name'];
        $user->email = $data['email'];
        $user->role = $data['role'];

        if (! empty($data['password'])) {
            $user->password = $data['password'];
        }

        $user->save();

        Colaborador::query()
            ->where('user_id', $user->id)
            ->update(['user_id' => null]);

        if (! empty($data['colaborador_id'])) {
            Colaborador::query()
                ->whereKey((int) $data['colaborador_id'])
                ->update(['user_id' => $user->id]);
        }

        $this->syncAccessScopes($user, (array) ($data['access_scopes'] ?? []));
        TransportCache::bumpMany(['permissions', 'home']);

        return response()->json([
            'data' => $user->refresh()->load(['colaborador:id,nome,user_id', 'accessScopes']),
        ]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $actor = $request->user();

        abort_unless($actor?->isMasterAdmin(), 403);
        abort_if($actor->id === $user->id, 422, 'Você não pode excluir seu próprio usuário.');

        Colaborador::query()
            ->where('user_id', $user->id)
            ->update(['user_id' => null]);

        $user->tokens()->delete();
        $user->delete();
        TransportCache::bumpMany(['permissions', 'home']);

        return response()->json([], 204);
    }

    /**
     * @param  array<int, array<string, mixed>>  $scopes
     */
    private function syncAccessScopes(User $user, array $scopes): void
    {
        $normalizedScopes = AccessScopeCatalog::normalize($scopes);

        $user->accessScopes()->delete();

        foreach ($normalizedScopes as $scope) {
            $user->accessScopes()->create($scope);
        }
    }
}
