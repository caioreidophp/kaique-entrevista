<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('personal_access_tokens', function (Blueprint $table): void {
            if (! Schema::hasColumn('personal_access_tokens', 'ip_address')) {
                $table->string('ip_address', 45)->nullable()->after('name');
            }

            if (! Schema::hasColumn('personal_access_tokens', 'user_agent')) {
                $table->string('user_agent', 1024)->nullable()->after('ip_address');
            }

            if (! Schema::hasColumn('personal_access_tokens', 'last_activity_at')) {
                $table->timestamp('last_activity_at')->nullable()->after('last_used_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('personal_access_tokens', function (Blueprint $table): void {
            if (Schema::hasColumn('personal_access_tokens', 'last_activity_at')) {
                $table->dropColumn('last_activity_at');
            }

            if (Schema::hasColumn('personal_access_tokens', 'user_agent')) {
                $table->dropColumn('user_agent');
            }

            if (Schema::hasColumn('personal_access_tokens', 'ip_address')) {
                $table->dropColumn('ip_address');
            }
        });
    }
};
