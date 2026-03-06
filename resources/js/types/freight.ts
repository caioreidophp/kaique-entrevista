export interface FreightUnit {
    id: number;
    nome: string;
}

export interface FreightEntry {
    id: number;
    data: string;
    unidade_id: number;
    autor_id: number;
    frete_total: string;
    cargas: number;
    aves: number;
    veiculos: number;
    km_rodado: string;
    frete_terceiros: string;
    viagens_terceiros: number;
    aves_terceiros: number;
    frete_liquido: string;
    cargas_liq: number;
    aves_liq: number;
    kaique: string;
    vdm: string;
    frete_programado: string;
    cargas_programadas: number;
    aves_programadas: number;
    cargas_canceladas_escaladas: number;
    nao_escaladas: number;
    placas: string | null;
    obs: string | null;
    unidade?: FreightUnit;
}

export interface FreightDashboardResponse {
    competencia_mes: number;
    competencia_ano: number;
    kpis: {
        total_lancamentos: number;
        total_frete: number;
        total_frete_liquido: number;
        total_km: number;
        total_aves: number;
        dias_trabalhados: number;
        frete_por_caminhao: number;
        frete_por_dia_trabalhado: number;
        media_reais_por_km: number;
        media_frete_por_km: number;
    };
    por_unidade: Array<{
        unidade_id: number;
        unidade_nome: string | null;
        total_lancamentos: number;
        total_frete: number;
        total_frete_liquido: number;
        total_km: number;
        total_aves: number;
        dias_trabalhados: number;
        frete_por_caminhao: number;
        frete_por_dia_trabalhado: number;
        frete_por_km: number;
        frete_liquido_por_km: number;
    }>;
    lancamentos_recentes: FreightEntry[];
}

export interface FreightMonthlyResponse {
    competencia_mes: number;
    competencia_ano: number;
    data: Array<{
        unidade_id: number;
        unidade_nome: string | null;
        dias_trabalhados: number;
        total_frete: number;
        total_frete_liquido: number;
        total_km_rodado: number;
        total_aves_transportadas: number;
        frete_por_caminhao: number;
        frete_por_dia_trabalhado: number;
        media_reais_por_km: number;
        media_frete_por_km: number;
    }>;
}

export interface FreightTimelineResponse {
    start_date: string;
    end_date: string;
    series: Array<{
        unidade_id: number;
        unidade_nome: string | null;
        points: Array<{
            data: string;
            frete_total: number;
        }>;
    }>;
}
