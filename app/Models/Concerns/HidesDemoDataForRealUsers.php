<?php

namespace App\Models\Concerns;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

trait HidesDemoDataForRealUsers
{
    /**
     * @var array<int, int>|null
     */
    private static ?array $demoUnitIdsForIsolation = null;

    private static ?int $demoUserIdForIsolation = null;

    protected static function bootHidesDemoDataForRealUsers(): void
    {
        static::addGlobalScope('hide-demo-data-for-real-users', function (Builder $builder): void {
            $user = Auth::user() ?? request()->user();

            if (! $user instanceof User || $user->isDemoAccount()) {
                return;
            }

            $model = $builder->getModel();
            $table = $model->getTable();
            $demoUnitIds = self::demoUnitIdsForIsolation();
            $demoUserId = self::demoUserIdForIsolation();

            if ($table === 'unidades' && self::hasColumn($table, 'slug')) {
                $builder->where(function (Builder $query) use ($table): void {
                    $query
                        ->whereNull($table.'.slug')
                        ->orWhere($table.'.slug', 'not like', 'demo-%');
                });

                return;
            }

            if ($table === 'tipos_pagamento' && self::hasColumn($table, 'nome')) {
                $builder->where(function (Builder $query) use ($table): void {
                    $query
                        ->whereNull($table.'.nome')
                        ->orWhere($table.'.nome', 'not like', 'Demo %');
                });
            }

            if ($demoUnitIds !== []) {
                foreach (['unidade_id', 'hiring_unidade_id', 'unidade_origem_id'] as $column) {
                    if (self::hasColumn($table, $column)) {
                        $builder->where(function (Builder $query) use ($table, $column, $demoUnitIds): void {
                            $query
                                ->whereNull($table.'.'.$column)
                                ->orWhereNotIn($table.'.'.$column, $demoUnitIds);
                        });
                    }
                }
            }

            if ($demoUserId !== null) {
                foreach (['author_id', 'autor_id', 'user_id', 'created_by'] as $column) {
                    if (self::hasColumn($table, $column)) {
                        $builder->where(function (Builder $query) use ($table, $column, $demoUserId): void {
                            $query
                                ->whereNull($table.'.'.$column)
                                ->orWhere($table.'.'.$column, '!=', $demoUserId);
                        });
                    }
                }
            }

            if (self::hasColumn($table, 'unit_name')) {
                $builder->where(function (Builder $query) use ($table): void {
                    $query
                        ->whereNull($table.'.unit_name')
                        ->orWhere($table.'.unit_name', 'not like', 'Demo %');
                });
            }
        });
    }

    /**
     * @return array<int, int>
     */
    private static function demoUnitIdsForIsolation(): array
    {
        if (self::$demoUnitIdsForIsolation !== null) {
            return self::$demoUnitIdsForIsolation;
        }

        self::$demoUnitIdsForIsolation = DB::table('unidades')
            ->where('slug', 'like', 'demo-%')
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->values()
            ->all();

        return self::$demoUnitIdsForIsolation;
    }

    private static function demoUserIdForIsolation(): ?int
    {
        if (self::$demoUserIdForIsolation !== null) {
            return self::$demoUserIdForIsolation;
        }

        $email = (string) config('services.demo.email');

        self::$demoUserIdForIsolation = $email !== ''
            ? DB::table('users')->where('email', $email)->value('id')
            : null;

        if (self::$demoUserIdForIsolation !== null) {
            self::$demoUserIdForIsolation = (int) self::$demoUserIdForIsolation;
        }

        return self::$demoUserIdForIsolation;
    }

    private static function hasColumn(string $table, string $column): bool
    {
        static $cache = [];

        $key = $table.'.'.$column;

        if (! array_key_exists($key, $cache)) {
            $cache[$key] = Schema::hasColumn($table, $column);
        }

        return (bool) $cache[$key];
    }
}
