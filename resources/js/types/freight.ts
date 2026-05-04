export interface FreightUnit {
    id: number;
    nome: string;
}

export interface FreightEntry {
    id: number;
    data: string;
    dia_semana?: string;
    unidade_id: number;
    autor_id: number;
    frete_total: string;
    cargas: number;
    aves: number;
    veiculos: number;
    km_rodado: string;
    km_terceiros: string;
    frete_terceiros: string;
    viagens_terceiros: number;
    aves_terceiros: number;
    frete_liquido: string;
    cargas_liq: number;
    aves_liq: number;
    kaique: string;
    vdm: string;
    frete_programado: string;
    km_programado: string;
    cargas_programadas: number;
    aves_programadas: number;
    cargas_canceladas_escaladas: number;
    nao_escaladas: number;
    programado_frete: string;
    programado_viagens: number;
    programado_aves: number;
    programado_km: string;
    kaique_geral_frete: string;
    kaique_geral_viagens: number;
    kaique_geral_aves: number;
    kaique_geral_km: string;
    terceiros_frete: string;
    terceiros_viagens: number;
    terceiros_aves: number;
    terceiros_km: string;
    abatedouro_frete: string;
    abatedouro_viagens: number;
    abatedouro_aves: number;
    abatedouro_km: string;
    canceladas_sem_escalar_frete: string;
    canceladas_sem_escalar_viagens: number;
    canceladas_sem_escalar_aves: number;
    canceladas_sem_escalar_km: string;
    canceladas_escaladas_frete: string;
    canceladas_escaladas_viagens: number;
    canceladas_escaladas_aves: number;
    canceladas_escaladas_km: string;
    placas: string | null;
    obs: string | null;
    unidade?: FreightUnit;
}

export interface FreightSpotEntry {
    id: number;
    data: string;
    unidade_origem_id: number;
    autor_id: number;
    frete_spot: string;
    cargas: number;
    aves: number;
    km_rodado: string;
    obs: string | null;
    unidade_origem?: FreightUnit;
}

export interface FreightOperationalReportResponse {
    competencia_mes: number;
    competencia_ano: number;
    unidade_id?: number | null;
    programado?: {
        frete: number;
        km: number;
        aves: number;
        cargas: number;
    };
    abatedouro: {
        resumo: FreightExecutionMetrics;
        por_unidade: Array<FreightExecutionMetrics & { unidade_id: number; unidade_nome: string | null }>;
    };
    kaique: {
        integracao: {
            resumo: FreightExecutionMetrics;
            por_unidade: Array<FreightExecutionMetrics & { unidade_id: number; unidade_nome: string | null }>;
        };
        spot: {
            resumo: FreightExecutionMetrics;
            por_unidade: Array<FreightExecutionMetrics & { unidade_id: number; unidade_nome: string | null }>;
        };
        percentual_spot_total: number;
    };
    geral_kaique: {
        total_abatedouro: number;
        frota_dentro: number;
        frota_fora: number;
        total_frota: number;
    };
    abatedouro_legacy?: Array<Record<string, unknown>>;
    frota?: Array<Record<string, unknown>>;
}

export interface FreightExecutionMetrics {
    dias_abate: number;
    total_frete: number;
    km_rodado: number;
    aves_abatidas: number;
    cargas: number;
    frete_por_km: number;
    aves_por_carga: number;
    frete_medio_carga: number;
    raio_medio: number;
    participacao_terceiros_percent: number;
    frete_terceiros: number;
    km_terceiros: number;
    cargas_terceiros: number;
    aves_terceiros: number;
    percentual_spot: number;
    programado: {
        frete: number;
        km: number;
        aves: number;
        cargas: number;
    };
    percentual_realizado: {
        frete: number;
        km: number;
        aves: number;
        cargas: number;
    };
}

export interface FreightDashboardResponse {
    competencia_mes: number;
    competencia_ano: number;
    kpis: {
        total_lancamentos: number;
        total_frete: number;
        total_frete_liquido: number;
        total_km: number;
        total_km_terceiros: number;
        total_frete_terceiros: number;
        total_viagens_terceiros: number;
        total_aves: number;
        dias_trabalhados: number;
        frota_total_cadastrada: number | null;
        frete_por_caminhao: number;
        frete_medio_por_caminhao_trabalhado: number;
        frete_medio_por_caminhao_frota: number | null;
        frete_por_dia_trabalhado: number;
        media_reais_por_km: number;
        media_frete_por_km: number;
        frete_por_km: number;
        aves_por_carga: number;
        frete_medio: number;
        participacao_terceiros: number;
    };
    alerts?: Array<{
        level: 'warning' | 'info';
        key: string;
        message: string;
    }>;
    por_unidade: Array<{
        unidade_id: number;
        unidade_nome: string | null;
        total_lancamentos: number;
        total_frete: number;
        total_frete_liquido: number;
        total_km: number;
        total_aves: number;
        total_viagens_kaique: number;
        total_frete_terceiros: number;
        total_frete_programado: number;
        total_frota_unidade: number | null;
        frota_cadastrada: number | null;
        frota_informada: boolean;
        total_caminhoes_trabalhados: number;
        dias_trabalhados: number;
        frete_por_caminhao: number;
        frete_medio_por_caminhao_trabalhado: number;
        frete_medio_por_caminhao_frota: number | null;
        frete_por_dia_trabalhado: number;
        frete_por_km: number;
        frete_liquido_por_km: number;
        frete_kaique_por_km: number;
        frete_kaique_por_caminhao: number;
        frete_kaique_por_dia: number;
        aves_por_carga: number;
        frete_kaique_por_carga: number;
        percentual_frete_terceiros_sobre_programado: number;
        box_divisor: number;
        aves_media_por_caixa: number;
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
        caminhoes_trabalhados: number;
        frota_cadastrada: number | null;
        frota_informada: boolean;
        frete_por_caminhao: number;
        frete_medio_por_caminhao_trabalhado: number;
        frete_medio_por_caminhao_frota: number | null;
        frete_por_dia_trabalhado: number;
        media_reais_por_km: number;
        media_frete_por_km: number;
        abatedouro: FreightExecutionMetrics;
        kaique_integracao: FreightExecutionMetrics;
        kaique_spot: FreightExecutionMetrics;
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
