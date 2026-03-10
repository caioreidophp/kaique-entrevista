<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('pagamentos', function (Blueprint $table): void {
            $table->foreignId('tipo_pagamento_id')
                ->nullable()
                ->after('autor_id')
                ->constrained('tipos_pagamento')
                ->nullOnDelete();

            $table->string('descricao', 255)->nullable()->after('valor');
            $table->date('data_pagamento')->nullable()->after('descricao');

            $table->dropUnique('pagamentos_colaborador_competencia_unique');
            $table->index('tipo_pagamento_id', 'pagamentos_tipo_pagamento_index');
            $table->index('data_pagamento', 'pagamentos_data_pagamento_index');
            $table->unique(
                ['colaborador_id', 'tipo_pagamento_id', 'data_pagamento'],
                'pagamentos_colaborador_tipo_data_unique',
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pagamentos', function (Blueprint $table): void {
            $table->dropUnique('pagamentos_colaborador_tipo_data_unique');
            $table->dropIndex('pagamentos_tipo_pagamento_index');
            $table->dropIndex('pagamentos_data_pagamento_index');
            $table->dropConstrainedForeignId('tipo_pagamento_id');
            $table->dropColumn(['descricao', 'data_pagamento']);

            $table->unique(
                ['colaborador_id', 'competencia_mes', 'competencia_ano'],
                'pagamentos_colaborador_competencia_unique',
            );
        });
    }
};
