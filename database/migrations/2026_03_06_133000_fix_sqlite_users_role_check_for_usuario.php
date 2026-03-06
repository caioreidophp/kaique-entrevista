<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::getDriverName() !== 'sqlite' || ! Schema::hasTable('users')) {
            return;
        }

        Schema::disableForeignKeyConstraints();

        DB::statement("CREATE TABLE users_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            name VARCHAR NOT NULL,
            email VARCHAR NOT NULL,
            email_verified_at DATETIME,
            password VARCHAR NOT NULL,
            two_factor_secret TEXT,
            two_factor_recovery_codes TEXT,
            two_factor_confirmed_at DATETIME,
            role VARCHAR NOT NULL DEFAULT 'admin' CHECK (role IN ('master_admin', 'admin', 'usuario')),
            remember_token VARCHAR,
            created_at DATETIME,
            updated_at DATETIME
        )");

        DB::statement("INSERT INTO users_new (
            id, name, email, email_verified_at, password,
            two_factor_secret, two_factor_recovery_codes, two_factor_confirmed_at,
            role, remember_token, created_at, updated_at
        )
        SELECT
            id, name, email, email_verified_at, password,
            two_factor_secret, two_factor_recovery_codes, two_factor_confirmed_at,
            CASE
                WHEN role IN ('master_admin', 'admin', 'usuario') THEN role
                ELSE 'admin'
            END,
            remember_token, created_at, updated_at
        FROM users");

        DB::statement("DROP TABLE users");
        DB::statement("ALTER TABLE users_new RENAME TO users");
        DB::statement("CREATE UNIQUE INDEX users_email_unique ON users (email)");
        DB::statement("CREATE INDEX users_role_index ON users (role)");

        Schema::enableForeignKeyConstraints();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() !== 'sqlite' || ! Schema::hasTable('users')) {
            return;
        }

        Schema::disableForeignKeyConstraints();

        DB::statement("CREATE TABLE users_old (
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            name VARCHAR NOT NULL,
            email VARCHAR NOT NULL,
            email_verified_at DATETIME,
            password VARCHAR NOT NULL,
            two_factor_secret TEXT,
            two_factor_recovery_codes TEXT,
            two_factor_confirmed_at DATETIME,
            role VARCHAR NOT NULL DEFAULT 'admin' CHECK (role IN ('master_admin', 'admin')),
            remember_token VARCHAR,
            created_at DATETIME,
            updated_at DATETIME
        )");

        DB::statement("INSERT INTO users_old (
            id, name, email, email_verified_at, password,
            two_factor_secret, two_factor_recovery_codes, two_factor_confirmed_at,
            role, remember_token, created_at, updated_at
        )
        SELECT
            id, name, email, email_verified_at, password,
            two_factor_secret, two_factor_recovery_codes, two_factor_confirmed_at,
            CASE
                WHEN role = 'usuario' THEN 'admin'
                ELSE role
            END,
            remember_token, created_at, updated_at
        FROM users");

        DB::statement("DROP TABLE users");
        DB::statement("ALTER TABLE users_old RENAME TO users");
        DB::statement("CREATE UNIQUE INDEX users_email_unique ON users (email)");
        DB::statement("CREATE INDEX users_role_index ON users (role)");

        Schema::enableForeignKeyConstraints();
    }
};
