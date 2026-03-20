import { LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { ApiError, apiGet } from '@/lib/api-client';
import { formatDateTimeBR } from '@/lib/transport-format';

interface ActivityCauser {
    id: number;
    name: string;
    email: string;
}

interface ActivityChange {
    old?: Record<string, unknown>;
    attributes?: Record<string, unknown>;
}

interface ActivityLogItem {
    id: number;
    log_name: string | null;
    description: string;
    event: string | null;
    subject_type: string | null;
    subject_id: number | null;
    changes: ActivityChange | null;
    causer: ActivityCauser | null;
    created_at: string;
}

interface ActivityLogResponse {
    data: ActivityLogItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

const logNameLabel: Record<string, string> = {
    default: 'Entrevista',
    frete: 'Frete',
    folha: 'Folha',
    cadastro: 'Cadastro',
};

const eventLabel: Record<string, string> = {
    created: 'Criou',
    updated: 'Atualizou',
    deleted: 'Excluiu',
};

const eventVariant: Record<
    string,
    'default' | 'secondary' | 'destructive' | 'outline'
> = {
    created: 'default',
    updated: 'secondary',
    deleted: 'destructive',
};

interface UpdateLogSection {
    panel: string;
    items: Array<{
        title: string;
        details: string[];
    }>;
}

interface UpdateLogDay {
    dateLabel: string;
    sections: UpdateLogSection[];
}

const updateLogTimeline: UpdateLogDay[] = [
    {
        dateLabel: 'Sexta-Feira, 20/03/2026',
        sections: [
            {
                panel: 'Painel de Cadastro',
                items: [
                    {
                        title: 'Matriz completa de permissões para Master Admin (checklist operacional por painel/página/ação)',
                        details: [
                            'Consolidado checklist único de permissões para uso do Master Admin com cobertura de Sidebar, páginas web e ações de API por módulo (Entrevistas, Cadastro, Folha, Férias, Fretes, Configurações e Log).',
                            'Estrutura passou a separar permissão de navegação (ver item no menu) de permissão de execução (listar, criar, editar, excluir, importar, exportar), reduzindo ambiguidade na configuração de papéis.',
                            'Inventário agora inclui permissões granulares de visibilidade de dados (somente próprios registros vs todos os autores) e campos sensíveis (documentos, dados bancários e trilha de auditoria).',
                            'Cadastro de Usuários recebeu tela funcional de Permissões por função com checklist editável por cargo (Master Admin/Admin/Usuário), com gravação em banco e leitura por API dedicada.',
                            'O menu lateral passou a respeitar permissões configuradas para exibir/ocultar painéis e páginas da sidebar conforme o cargo selecionado pelo Master Admin.',
                            'Exemplo crítico solicitado foi aplicado: visibilidade de entrevistas de outros usuários virou permissão explícita e já influencia política/controlador da lista de entrevistas.',
                            'Documento operacional de referência foi atualizado em `documentos/transport-permissions-matrix.md` para marcação manual por perfil antes da implementação do gerenciador de permissões na interface.',
                        ],
                    },
                ],
            },
            {
                panel: 'Plataforma',
                items: [
                    {
                        title: 'Rollback total de Ação Crítica para restaurar fluxo operacional',
                        details: [
                            'Removido o gatilho de confirmação crítica no cliente da API, eliminando popup e cancelamentos automáticos em operações de uso diário.',
                            'Removido o bloqueio backend que exigia header de confirmação e retornava HTTP 428 em rotas sensíveis.',
                            'Pipeline da API deixou de registrar middleware de Ação Crítica, garantindo que importações XLSX e demais ações sigam sem bloqueio adicional.',
                            'Modal de Permissões por função recebeu correção de rolagem vertical completa para exibir todos os painéis/grupos/checklists até o final sem conteúdo cortado.',
                        ],
                    },
                    {
                        title: 'Varredura técnica completa de estabilidade (backend + frontend + UX)',
                        details: [
                            'Suíte Laravel completa foi executada novamente com 119 testes aprovados, incluindo validação do cenário de entrevistas com regra de visibilidade por autor.',
                            'Validações de frontend foram reexecutadas com sucesso (ESLint, TypeScript e build de produção), removendo erros de imports, variáveis não usadas e inconsistências de hooks.',
                            'Fluxo mobile (driver-app) recebeu ajuste de escopo global no arquivo de Babel para eliminar erro de lint e manter a checagem unificada do repositório sem falso positivo.',
                            'Após os ajustes, ambiente foi reotimizado e check online no domínio fixo confirmou disponibilidade com status 200.',
                        ],
                    },
                    {
                        title: 'Fechamento de qualidade sem pendências (lint PHP + bateria full)',
                        details: [
                            'Todos os 46 apontamentos de estilo PHP do Pint foram corrigidos automaticamente e a checagem `composer test:lint` passou sem erros.',
                            'Após auto-fix, foi feita nova rodada completa de validação: backend (119 testes), frontend (lint + types) e build de produção, tudo aprovado.',
                            'Checks operacionais finais foram repetidos no fechamento (migrate, optimize e health endpoint) mantendo resultado estável e status 200 em produção.',
                        ],
                    },
                ],
            },
            {
                panel: 'Gestão de Fretes',
                items: [
                    {
                        title: 'Permissões por função integradas à Home + correção de inteiro no Lançar Fretes',
                        details: [
                            'A Home passou a renderizar painéis de acordo com permissões realmente configuradas por função, eliminando cenário de precisar entrar por URL para acessar módulo autorizado.',
                            'Tela de Permissões por função recebeu botão direto "Ver painéis na Home" para validar visualmente a configuração após salvar.',
                            'No Lançar Fretes, campos de aves/viagens/veículos passaram a ser normalizados para inteiro no envio, evitando erro de validação `integer` em entradas com separador de milhar no padrão brasileiro.',
                            'Cálculo de métricas da Home foi otimizado para rodar apenas para módulos permitidos ao perfil, reduzindo consultas desnecessárias.',
                        ],
                    },
                ],
            },
            {
                panel: 'Painel de Folha',
                items: [
                    {
                        title: 'Desconto parcelado da folha corrigido para aplicar por mês',
                        details: [
                            'Na prévia de descontos do fechamento da folha, descontos parcelados agora respeitam competência mensal e aplicam somente a parcela do mês (ex.: 250 em 5x aplica 50 por mês).',
                            'Saldo restante exibido no detalhe passa a refletir o total pendente real do desconto após as parcelas já vencidas/aplicadas, sem consumir tudo em um único fechamento.',
                            'Incluído teste de regressão na API da folha cobrindo cenário parcelado para evitar retorno desse comportamento em versões futuras.',
                        ],
                    },
                ],
            },
        ],
    },
    {
        dateLabel: 'Segunda-Feira, 16/03/2026',
        sections: [
            {
                panel: 'Gestão de Fretes',
                items: [
                    {
                        title: 'Rollout transversal: toast global, debounce de buscas, throttling e ampliação de testes (Feature + Unit)',
                        details: [
                            'Componente Notification foi padronizado como toast discreto global (posição fixa, leitura acessível e visual suave) para respostas de sucesso/erro/info em todas as páginas que já usam o componente compartilhado.',
                            'Layout administrativo recebeu escopo global de hover em linhas de tabela, aplicando destaque sutil de linha de forma consistente no sistema.',
                            'Debounce de 300ms foi propagado para buscas em telas centrais (Next Steps, Onboarding e Log de Atividades) para reduzir requisições/reprocessamentos durante digitação.',
                            'API recebeu reforço de rate limit em endpoints de escrita de múltiplos módulos (Configurações, Folha, Entrevistas e Cadastros), reduzindo risco de abuso e picos de carga.',
                            'Suíte de testes foi expandida com novos cenários de fretes: criação/validações backend, importação e preview XLSX no mapeamento B1..B27, fluxo de cargas canceladas (faturar/desfaturar/excluir) e checks de endpoints principais; além de novo teste Unit para validação inteligente do StoreFreightEntryRequest.',
                            'Revalidação técnica executada no fechamento: build frontend, migrate, optimize clear + optimize, suíte completa de APIs e checagem online local (HTTP 200 em :8000).',
                        ],
                    },
                    {
                        title: 'Hardening transversal: confirmação de ação crítica, snapshots por perfil e destaque global de alterações pendentes',
                        details: [
                            'API Client passou a exigir confirmação explícita para operações críticas (DELETE/import/batch/billing/settings sensível), com janela de confirmação reutilizável por 5 minutos para evitar clique acidental em massa.',
                            'Middleware de API foi incluído para reforçar confirmação de ação crítica por header dedicado, garantindo trilha consistente entre frontend e backend em produção.',
                            'Admin Layout recebeu atalhos globais: Ctrl+S para salvar, Alt+Shift+1..3 para salvar perfil de filtros/formulário e Alt+1..3 para reaplicar perfil na mesma tela.',
                            'Formulários em todas as páginas dentro do layout administrativo agora destacam campos alterados (estado pendente) e avisam ao sair da página sem salvar.',
                            'Cache curto inteligente de GET foi adicionado para endpoints de referência (cidades/unidades/funções/tipos) para reduzir requisições redundantes e acelerar carregamento de filtros.',
                            'Fluxo de importação de colaboradores recebeu ação rápida de cópia de linha com erro para correção mais ágil na planilha.',
                            'Revalidação técnica executada no fechamento: build frontend OK, migrate OK, optimize clear/optimize OK, suíte alvo com 48 testes/201 assertions e check online local HTTP 200.',
                        ],
                    },
                    {
                        title: 'Central Analítica e Folha: leitura sem hover, tabela alinhada e edição agrupada com VT/VR inteligente',
                        details: [
                            'A Tendência da Central Analítica recebeu rótulos de eixo Y com valores monetários e rótulos no eixo X com períodos (dia/mês), permitindo leitura rápida sem depender do hover nas bolinhas.',
                            'A tabela de Lançamentos agrupados em Pagamentos foi realinhada (larguras/centralização), corrigindo desalinhamento visual da coluna Colaboradores e do contador por linha.',
                            'Fluxo de Editar completo em pagamento agrupado foi destravado para permitir edição dos tipos já existentes do próprio lançamento, mantendo proteção contra duplicidade indevida de outros lançamentos.',
                            'Lançar Pagamentos ganhou campos operacionais para Vale Refeição/Transporte: dias úteis por colaborador, padrão geral de dias úteis e valor diário por benefício com preenchimento automático da grade.',
                            'Navegação entre inputs de valores na matriz de lançamento foi ampliada com setas ↑ ↓ ← → (além de Enter/Tab), acelerando digitação em lote no teclado.',
                            'Backend e validação de lote foram ajustados para suportar atualização dos itens existentes no lançamento agrupado, e a suíte recebeu teste de regressão para garantir esse comportamento.',
                        ],
                    },
                    {
                        title: 'Ajuste fino do gráfico: valores do eixo Y sem corte visual',
                        details: [
                            'No gráfico de Tendência da Central Analítica, a área útil recebeu margem esquerda maior para acomodar rótulos monetários longos no eixo Y sem truncamento.',
                            'O posicionamento dos labels de valor foi recalibrado para manter leitura completa dos números em qualquer faixa (diário e mensal).',
                            'A escala de meses no eixo X foi mantida conforme o ajuste anterior, preservando a leitura por coluna.',
                        ],
                    },
                    {
                        title: 'Lançar Pagamentos: campos de topo alinhados por coluna e sem rótulos extras',
                        details: [
                            'Os campos globais de dias úteis, valor diário de vale refeição e valor diário de vale transporte foram movidos para uma linha da própria tabela, imediatamente acima das colunas correspondentes.',
                            'A linha de inputs ficou sem títulos/labels adicionais, mantendo leitura limpa conforme o layout solicitado.',
                            'Campos de benefício agora aparecem apenas quando o tipo respectivo está selecionado; colunas não selecionadas não exibem campo vazio de configuração.',
                        ],
                    },
                    {
                        title: 'Lançar Pagamentos: arredondamento do VT, dias úteis zerados e peso visual dos campos de topo',
                        details: [
                            'O cálculo automático de Vale Transporte passou a arredondar o total sempre para cima no próximo múltiplo de 5 (ex.: 172→175 e 188→190), evitando pagamento abaixo do valor calculado.',
                            'Dias úteis padrão agora iniciam em 0 no topo e no preenchimento inicial por colaborador, removendo o valor pré-definido de 22.',
                            'Campos de configuração no topo da grade (dias úteis e diárias de benefício) tiveram peso de fonte normalizado, removendo aparência em negrito.',
                        ],
                    },
                    {
                        title: 'Editar Pagamentos: valores existentes dentro dos inputs e correção de duplicidade ao salvar',
                        details: [
                            'Ao abrir Editar completo, os valores já lançados por tipo agora entram direto nos campos de texto para ajuste imediato, inclusive VR/VT, sem depender de texto auxiliar abaixo.',
                            'Indicador textual de Já lançado foi removido da grade de valores para manter foco na edição inline dos próprios inputs.',
                            'Auto preenchimento de benefícios não sobrescreve mais os valores existentes ao carregar a tela; ele só passa a atuar após interação nos campos de dias úteis/diária.',
                            'Fluxo de salvar foi reforçado para localizar e atualizar pagamento existente pelo par colaborador + tipo + data, evitando erro de UNIQUE quando houver divergência histórica de unidade/descrição.',
                        ],
                    },
                    {
                        title: 'Editar Pagamentos: campos de multiplicação do topo também pré-carregados + ajustes de performance da grade',
                        details: [
                            'No fluxo Lista → Editar completo, os campos superiores de dias úteis, diária de VR e diária de VT agora também são preenchidos no carregamento inicial para evitar abertura zerada durante edição.',
                            'Para lançamentos antigos sem metadado explícito de multiplicação, foi aplicado fallback seguro de pré-carga para manter consistência visual e operacional dos campos no topo.',
                            'A matriz de lançamento recebeu redução de re-render desnecessário com guardas de igualdade em updates de seleção e valores, melhorando fluidez de digitação em lote.',
                        ],
                    },
                    {
                        title: 'Editar Pagamentos: multiplicadores do topo voltam a iniciar zerados por padrão',
                        details: [
                            'Por ajuste operacional, os campos superiores de multiplicação (dias úteis, diária VR e diária VT) no modo Editar completo passaram a abrir novamente em 0.',
                            'O fluxo de edição mantém os valores existentes dentro da grade por colaborador/tipo, sem reaproveitar valores inferidos nos campos de topo.',
                        ],
                    },
                    {
                        title: 'Central Analítica: Tendência com modo mensal e presets por contexto',
                        details: [
                            'A aba principal foi simplificada de Tendência diária para Tendência, mantendo leitura unificada do gráfico por período.',
                            'Foi incluída alternância de modo Diário/Mês dentro da Tendência, com agregação mensal por unidade no mesmo gráfico.',
                            'No modo Mês, o recorte passou a oferecer 1A, 3A e 5A com pontos mensais (ex.: Fev/2026) no tooltip e na evolução.',
                            'No modo Diário, os presets foram enxugados para 1S, 1M e 1A, removendo 5A e Máx conforme solicitado.',
                        ],
                    },
                    {
                        title: 'Investigação de travamentos na navegação e otimização de render em tela crítica',
                        details: [
                            'Foi executada auditoria técnica focada em troca de páginas e padrões de re-render pesado, com checagens de erros de frontend/backend e varredura de hotspots de loops no React.',
                            'Na Central Analítica, o cálculo do gráfico foi refatorado para pré-indexar pontos por unidade/período em memoização, removendo buscas repetidas em render e reduzindo custo computacional em filtros e hover.',
                            'Bootstrap do app React foi simplificado para eliminar StrictMode no carregamento principal, reduzindo sobrecarga de desenvolvimento e sensação de travamento durante iterações locais.',
                            'Build de produção foi validado após as otimizações e a estratégia de chunking foi ajustada sem warning de circularidade, mantendo estabilidade do empacotamento.',
                            'Validação de saúde executada no fechamento: suítes críticas de API (44 testes/190 assertions), migrate, optimize clear/optimize e check online local com HTTP 200.',
                        ],
                    },
                    {
                        title: 'Revisão transversal de qualidade: reuso de máscaras, padronização e regra de alerta de KM',
                        details: [
                            'Foi realizada revisão técnica ampla do projeto para mapear duplicações e oportunidades de reutilização sem alteração de comportamento funcional.',
                            'As máscaras de entrada numérica/moeda de Fretes (antes duplicadas em telas diferentes) foram extraídas para util compartilhado e reaproveitadas em Lançar Fretes e Fretes Spot.',
                            'Dashboard Executivo passou a usar o formatador monetário central, reduzindo variação de implementação local de moeda.',
                            'A regra de alerta operacional de KM foi ajustada para o padrão solicitado: alerta de KM muito alto apenas acima de 10000 e alerta de KM muito baixo abaixo de 1000.',
                            'A validação inteligente de KM no lançamento também foi alinhada ao novo teto operacional para evitar inconsistência entre bloqueio de cadastro e alerta analítico.',
                            'Cobertura de testes foi ampliada com cenário específico dos novos limiares (alto/baixo) no dashboard de fretes.',
                        ],
                    },
                    {
                        title: 'Aprimoramentos de robustez: XLSX novo layout, validação inteligente e UX de tabelas',
                        details: [
                            'Importação e pré-visualização XLSX em Fretes foram alinhadas ao novo mapeamento oficial (B1..B27), incluindo Programado, Kaique Geral, Terceiros, Abatedouro e blocos de Canceladas sem/escaladas.',
                            'Leitura de cargas canceladas detalhadas foi mantida a partir da linha 30 (A=aviário, C=placa, D=frete) com sincronização segura no salvamento.',
                            'Backend recebeu validações inteligentes para bloquear lançamento sem viagens/cargas e sinalizar KM diário fora de faixa operacional esperada.',
                            'Dashboard de fretes ganhou indicadores adicionais (Frete/KM, Aves por carga e Frete médio) e alertas automáticos de outlier (KM alto, frete baixo e carga vazia).',
                            'Telas de Lançar Fretes e Cargas Canceladas receberam melhorias de UX/performance: skeleton de carregamento, confirmação modal para exclusão, hover de linhas e debounce de busca em placa.',
                            'Navegação por setas no campo nº viagem em Cargas Canceladas foi otimizada para reduzir custo de re-render e busca de índice durante edição em sequência.',
                        ],
                    },
                    {
                        title: 'Nova matriz de lançamento de fretes + usabilidade mobile e navegação de canceladas',
                        details: [
                            'Sidebar foi ajustada para manter o bloco Acesso geral fixo no rodapé (desktop e menu mobile), com navegação do módulo em área rolável separada.',
                            'Lançamento de fretes recebeu novo modelo persistido com 6 linhas fixas (Programado, Kaique geral, Terceiros, Abatedouro, Canceladas sem escalar e Canceladas escaladas), cada uma com Frete/Viagens/Aves/Km.',
                            'Backend passou a salvar os novos campos em banco e sincronizar automaticamente os campos legados para manter dashboards, listas e relatórios atuais funcionando.',
                            'Tela de lançamento foi redesenhada para o novo formato e ganhou versão em cartões no mobile na lista de lançamentos principais.',
                            'Em Cargas Canceladas, setas ↑/↓ agora navegam entre linhas durante edição do nº viagem; a tela também recebeu visual mobile em cartões para A Receber e Recebidas.',
                        ],
                    },
                    {
                        title: 'Blindagem de segurança e retomada da hospedagem pública',
                        details: [
                            'Publicação via domínio fixo foi reforçada para subir em modo seguro (APP em produção, debug desativado, HTTPS forçado, cookie de sessão seguro e sessão criptografada).',
                            'Inicialização de hosting público passou a gerar logs dedicados de PHP e cloudflared para diagnóstico rápido de queda, além de validação de processo ativo na subida.',
                            'Aplicação passou a forçar esquema HTTPS quando a flag de segurança estiver ativa, reduzindo risco de navegação insegura e links internos em http.',
                            'Configuração de sessão foi ajustada para respeitar detecção segura por proxy/HTTPS quando variável não for definida explicitamente.',
                            'Checklist técnico de fechamento foi reexecutado com build, migrate, cache e testes críticos para garantir integridade após hardening.',
                        ],
                    },
                    {
                        title: 'Pendências finalizadas: dashboard executivo removido, padronização e validação fim-a-fim',
                        details: [
                            'Dashboard Executivo foi removido da navegação/superfície e o Hub Operacional foi consolidado como Pendências (`/transport/pendencias`), com redirecionamento de compatibilidade a partir da rota antiga.',
                            'Sidebar foi reorganizada em Navegação do módulo e Acesso geral, com correção de overflow para manter o botão Sair sempre visível.',
                            'Formato de data/moeda/número foi centralizado no util compartilhado e aplicado em telas críticas de Fretes, Folha e Entrevistas, reduzindo divergência visual entre listas, dashboards e relatórios.',
                            'KPIs dos dashboards foram ajustados para foco operacional (participação de terceiros, viagens, cobertura/pendências de folha, taxa de vencidas em férias e funil prático de entrevistas).',
                            'Fluxos críticos foram revalidados com suíte de API para fretes, folha, férias e entrevistas (37 testes passando), incluindo cobertura explícita de permissões por papel.',
                            'Smoke test no domínio público ativo `https://app.kaiquetransportes.com.br` retornou HTTP 200 após subida por script de hosting fixo.',
                        ],
                    },
                    {
                        title: 'Fechamento complementar: padronização final de formatadores e revalidação técnica',
                        details: [
                            'Padronização com util compartilhado foi estendida para telas residuais de Fretes/Folha (incluindo lista de folha, lançamentos, cargas canceladas e relatório operacional), reduzindo funções locais de data/moeda/km.',
                            'Utilitário central ganhou formatador decimal BR reutilizável para indicadores não monetários com casas fixas.',
                            'Build de frontend, migrate e ciclo de cache do Laravel foram executados novamente após o lote final de ajustes.',
                            'Suítes críticas de API (fretes, folha, férias e entrevistas) foram reexecutadas com 40 testes e 153 assertions passando.',
                            'Checagem de domínio público foi reexecutada e retornou 530 em borda Cloudflare no momento da validação (fora do escopo de código da aplicação).',
                        ],
                    },
                    {
                        title: 'Polimento de navegação e consistência visual operacional',
                        details: [
                            'Tabela de Lançamentos principais em Fretes passou a exibir KM como inteiro com separador de milhar (sem casas decimais).',
                            'Hub Operacional e Dashboard Executivo saíram dos cards centrais da Home e foram movidos para a área fixa da sidebar, junto dos atalhos utilitários.',
                            'Tela de Entrevistas recebeu campo de Data de Nascimento no formulário e na visualização detalhada da ficha.',
                        ],
                    },
                    {
                        title: 'Pacote modular de melhorias (removível por flags)',
                        details: [
                            'Ações de Colaboradores foram finalizadas no padrão enxuto por ícones e sem tooltip de caixa branca no hover.',
                            'Novas chaves de feature foram adicionadas para ativar/desativar rapidamente segurança extra, auditoria sensível, exports CSV e painéis de insights.',
                            'Exportação CSV foi habilitada para Cadastros de Colaboradores e Aviários com download autenticado no frontend.',
                            'Entraram duas novas visões operacionais: Operations Hub (pendências) e Executive Dashboard (KPIs e alertas).',
                            'Backend recebeu hardening com headers de segurança, trilha de auditoria para ações sensíveis e cache curto na listagem padrão de colaboradores.',
                        ],
                    },
                    {
                        title: 'Padronização de cadastro (Aviários e Colaboradores)',
                        details: [
                            'A coluna de KM em Aviários passou a exibir apenas número inteiro, removendo o sufixo decimal .00 para leitura operacional mais limpa.',
                            'O formulário de Aviário foi ajustado para entrada inteira de KM, alinhando com o padrão real de cadastro da operação.',
                            'Na lista de Colaboradores, as ações foram simplificadas para ícones (olho, lápis e lixeira vermelha) com comportamento visual de botão no hover/cursor.',
                        ],
                    },
                    {
                        title: 'Blindagem final de moeda em telas operacionais',
                        details: [
                            'Funções de formatação e leitura de moeda foram reforçadas para aceitar com segurança entradas pt-BR e formatos mistos sem inflar valores.',
                            'Ajustes aplicados em telas de folha e fretes usadas no dia a dia, reduzindo divergência entre valor digitado, salvo e exibido.',
                            'Tratamento passou a considerar fallback controlado para evitar NaN e manter consistência de totais/linhas em listagens.',
                        ],
                    },
                    {
                        title: 'Correções visuais críticas de lista (data e moeda)',
                        details: [
                            'A Lista de Fretes passou a interpretar corretamente valores monetários vindos da API sem inflar milhar/casas decimais.',
                            'A coluna de data da lista foi ajustada para não sofrer deslocamento de 1 dia por timezone no navegador.',
                            'Confirmações de exclusão da lista agora exibem a mesma data exata mostrada na tabela.',
                        ],
                    },
                    {
                        title: 'Prevenção de truncamento de dados no dashboard de fretes',
                        details: [
                            'A API de listagem de fretes passou a aceitar paginação até 500 itens para compatibilidade com o carregamento mensal do dashboard.',
                            'Ajuste elimina corte silencioso de lançamentos em meses com maior volume, mantendo totais e gráficos coerentes.',
                        ],
                    },
                ],
            },
            {
                panel: 'Plataforma',
                items: [
                    {
                        title: 'Padronização de data sem impacto de timezone em telas operacionais',
                        details: [
                            'Listas de Pagamentos e Relatório por Colaborador receberam formatação de data robusta para evitar exibição de dia anterior.',
                            'Data de criação em Entrevistas também foi normalizada para manter consistência visual entre usuários e navegadores.',
                        ],
                    },
                ],
            },
        ],
    },
    {
        dateLabel: 'Domingo, 15/03/2026',
        sections: [
            {
                panel: 'Gestão de Fretes',
                items: [
                    {
                        title: 'Correção de bugs críticos na visualização da Lista de Fretes',
                        details: [
                            'Corrigida interpretação de moeda na listagem para não inflar valores quando a API retorna decimal com ponto (ex.: 50922.66).',
                            'Corrigido deslocamento de data na tabela (off-by-one) removendo dependência de timezone na renderização do dia.',
                            'Edição já continuava correta; agora a exibição da lista também bate 100% com o valor e data lançados.',
                        ],
                    },
                    {
                        title: 'Hardening de segurança e performance em endpoints críticos',
                        details: [
                            'Timeline de fretes passou a validar datas de forma estrita e bloquear intervalos acima de 366 dias para evitar sobrecarga e abuso de consulta.',
                            'Endpoints de listagem (`entries` e `spot-entries`) receberam validações de entrada para datas/filtros/paginação, reduzindo risco de payload malformado e consultas desnecessárias.',
                            'Consulta da timeline foi otimizada com agregação SQL por unidade+data, reduzindo volume carregado em memória e melhorando tempo de resposta.',
                        ],
                    },
                    {
                        title: 'Blindagem operacional contra uso abusivo',
                        details: [
                            'Aplicados throttles dedicados para rotas pesadas de relatórios e backup (`transport-heavy` e `transport-backup`).',
                            'Backup ficou protegido com limite por hora para reduzir risco de exaustão por chamadas repetidas.',
                            'Criado novo índice composto para relatórios de pagamentos por autor+colaborador+competência, melhorando desempenho das consultas analíticas.',
                        ],
                    },
                ],
            },
        ],
    },
    {
        dateLabel: 'Sábado, 14/03/2026',
        sections: [
            {
                panel: 'Gestão de Fretes',
                items: [
                    {
                        title: 'Correção geral de erros + otimizações de performance de navegação',
                        details: [
                            'Lint/TypeScript foram estabilizados com ajustes em hooks, efeitos e dependências para evitar renderizações em cascata.',
                            'Autocompletes e fluxos de filtros foram refinados para reduzir recálculos e travamentos na troca de páginas.',
                            'Navegação lateral manteve prefetch ativo e recebeu limpeza de pontos que causavam sensação de lentidão.',
                        ],
                    },
                    {
                        title: 'API de Pagamentos compatibilizada e suíte de testes reforçada',
                        details: [
                            'Relatório por unidade voltou a expor total_pago_mes para compatibilidade com contratos existentes.',
                            'Período padrão de competência do relatório foi ajustado para ano corrente completo quando não há filtros explícitos.',
                            'Teste de Home foi atualizado para refletir a presença do módulo de férias sem dependência frágil de ordenação.',
                        ],
                    },
                ],
            },
        ],
    },
    {
        dateLabel: 'Sexta-Feira, 13/03/2026',
        sections: [
            {
                panel: 'Gestão de Fretes',
                items: [
                    {
                        title: 'Ícones da navegação de fretes refinados',
                        details: [
                            'Central Analítica recebeu ícone novo mais alinhado ao contexto de gráfico/evolução.',
                            'Cargas Canceladas passou a usar ícone com X para leitura visual imediata no menu.',
                        ],
                    },
                    {
                        title: 'Cabeçalho da sidebar refinado (logo + seta + animação)',
                        details: [
                            'Logo do Kaique voltou a ocupar largura cheia no topo para manter o visual proporcional no painel aberto.',
                            'Seta de minimizar foi reposicionada para a direita da linha do título do painel, eliminando espaço ocioso ao lado do logo.',
                            'Abertura e fechamento da sidebar receberam transição suave para evitar efeito de troca brusca.',
                        ],
                    },
                    {
                        title: 'Central Analítica unificada e navegação compacta',
                        details: [
                            'A antiga Inteligência de Fretes foi consolidada em uma única Central Analítica com alternância interna entre Tendência diária, Operacional e Análise mensal.',
                            'Sidebar recebeu modo minimizável com persistência local: no modo compacto os menus ficam só com ícones e logo reduzida.',
                            'Nomenclatura de Fretes foi padronizada para Central de Fretes / Central Analítica no menu e atalhos globais.',
                        ],
                    },
                    {
                        title: 'Gráfico com cortes rápidos de período e tooltip por ponto',
                        details: [
                            'Incluídos presets de período 1S, 1M, 1A, 5A e Máx para ajuste rápido da janela de análise.',
                            'Mantidos campos de data inicial/final para refinamento manual sem perder a visualização unificada.',
                            'Tooltip visual por ponto mostra unidade, data e valor no hover para leitura rápida em telas grandes e compactas.',
                        ],
                    },
                    {
                        title: 'Importar XLSX agora pré-preenche o formulário',
                        details: [
                            'Criado endpoint de pré-visualização da planilha para preencher os campos sem salvar automaticamente.',
                            'Fluxo no Lançar Fretes alterado: usuário importa, confere os dados na tela e só depois salva manualmente.',
                            'Pré-preenchimento também aplica as cargas canceladas escaladas quando existirem no arquivo.',
                        ],
                    },
                    {
                        title: 'Sidebar de fretes restaurada com telas antigas',
                        details: [
                            'Voltaram os atalhos de Relatório Operacional e Análise Mensal na navegação do módulo.',
                            'Mantida também a tela Inteligência de Fretes para evolução visual posterior.',
                        ],
                    },
                    {
                        title: 'Melhoria visual no gráfico da Inteligência de Fretes',
                        details: [
                            'Eixo diário contínuo entre data inicial e final (todos os dias do período).',
                            'Traços com largura uniforme e bolinhas por ponto de cada dia.',
                            'Adicionado tooltip nativo por ponto com unidade, data e valor do frete.',
                        ],
                    },
                ],
            },
            {
                panel: 'Plataforma',
                items: [
                    {
                        title: 'Troca de páginas mais rápida no menu lateral',
                        details: [
                            'Ativado prefetch nos links principais da sidebar (desktop e mobile) para antecipar carregamento das próximas telas.',
                            'Ajuste reduz sensação de travamento na navegação sem alterar regras de banco ou payload da API.',
                        ],
                    },
                    {
                        title: 'Ações de tabela mais limpas com ícones',
                        details: [
                            'Padronizadas ações sem texto (ícones) em Entrevistas e principais telas de Cadastro.',
                            'Ajustadas ações da tabela do Lançar Fretes para seguir o mesmo padrão visual clean.',
                        ],
                    },
                    {
                        title: 'Preparação para app mobile de motoristas',
                        details: [
                            'Criado roadmap técnico inicial em documentos para guiar implementação do app e integração com painel admin.',
                        ],
                    },
                ],
            },
        ],
    },
    {
        dateLabel: 'Quinta-Feira, 12/03/2026',
        sections: [
            {
                panel: 'Gestão de Fretes',
                items: [
                    {
                        title: 'Importação de planilha JBS no Lançar Fretes',
                        details: [
                            'Adicionada opção de importar XLSX diretamente no painel Lançar Fretes.',
                            'Importação processa lançamentos com atualização por data + unidade para evitar duplicidade.',
                            'Incluído resumo com total lido/importado/ignorado e detalhamento por linha com erro.',
                        ],
                    },
                    {
                        title: 'Melhoria de visibilidade dos campos de lançamento',
                        details: [
                            'Campos principais receberam maior destaque visual com borda reforçada e fundo de contraste.',
                            'Ajuste aplicado também nos campos de cargas canceladas e observações para leitura mais rápida.',
                        ],
                    },
                ],
            },
            {
                panel: 'Painel de Cadastro',
                items: [
                    {
                        title: 'Ordenação por coluna na tabela de colaboradores',
                        details: [
                            'Cabeçalhos da tabela passaram a ordenar por Nome, Função, Unidade, CPF e Status.',
                            'Implementado indicador visual por setas e regra de coluna única ativa por vez.',
                            'Ordenação conectada ao backend para manter consistência com paginação.',
                        ],
                    },
                    {
                        title: 'Sincronização bidirecional de férias no perfil do colaborador',
                        details: [
                            'A aba de férias do perfil agora consulta os mesmos lançamentos do Controle de Férias.',
                            'Novo lançamento feito no perfil grava no módulo oficial de férias e já retorna atualizado.',
                            'Fluxo unificado elimina rascunho local e mantém dados consistentes nos dois painéis.',
                        ],
                    },
                ],
            },
        ],
    },
    {
        dateLabel: 'Quarta-Feira, 11/03/2026',
        sections: [
            {
                panel: 'Painel de Cadastro',
                items: [
                    {
                        title: 'Novo painel Placas e Aviários',
                        details: [
                            'Criada tela única com duas frentes separadas: Placas e Aviários.',
                            'Cadastro de placa com vínculo da unidade da frota.',
                            'Cadastro de aviário com nome e cidade.',
                        ],
                    },
                    {
                        title: 'Novas APIs de cadastro',
                        details: [
                            'Criados endpoints para listar/cadastrar/editar/excluir placas e aviários.',
                            'Normalização de placa para caixa alta e validações de unicidade.',
                        ],
                    },
                    {
                        title: 'Cadastro em lote para Placas e Aviários',
                        details: [
                            'Adicionados botões e modais de cadastro em lote para inserir múltiplas placas de uma vez para a mesma unidade.',
                            'Adicionado cadastro em lote de aviários por cidade, com múltiplos nomes em uma única operação.',
                            'Criados endpoints específicos de bulk para placas e aviários, com prevenção de duplicados já existentes.',
                        ],
                    },
                ],
            },
            {
                panel: 'Gestão de Fretes',
                items: [
                    {
                        title: 'Integração de opções de placa e aviário no Lançar Fretes',
                        details: [
                            'Campos de cargas canceladas passaram a sugerir placas e aviários cadastrados.',
                            'Filtro de opções por começo do texto digitado (ex.: BC mostra placas iniciadas por BC).',
                            'Listas ordenadas em ordem alfabética.',
                        ],
                    },
                    {
                        title: 'Base para expansão em outros painéis',
                        details: [
                            'Cadastro centralizado pronto para reaproveitar em qualquer painel que pedir placa/aviário.',
                        ],
                    },
                    {
                        title: 'Máscaras de milhar em campos operacionais',
                        details: [
                            'Ajustada formatação dos campos de aves, km rodado e km terceiros para exibir separador de milhar sem forçar vírgula automática.',
                            'Comportamento aplicado no Lançar Fretes e no Lançar Fretes Spot para manter padrão de digitação.',
                        ],
                    },
                    {
                        title: 'Padronização de seleção no Lançar Férias',
                        details: [
                            'Campo de nome no lançamento de férias alterado para seleção por lista de opções ao clicar, sem exibir listagem fixa abaixo do campo.',
                            'Fluxo alinhado ao padrão de componentes de seleção já usados em outros pontos do sistema.',
                        ],
                    },
                ],
            },
            {
                panel: 'Painel Controle de Férias',
                items: [
                    {
                        title: 'Módulo próprio de Férias na navegação',
                        details: [
                            'Criado painel separado de Pagamentos com sidebar dedicada: Dashboard, Lista e Lançar Férias.',
                            'Home atualizada para exibir card do painel de Férias junto com os demais painéis principais.',
                        ],
                    },
                    {
                        title: 'Regra de período aquisitivo implementada',
                        details: [
                            'Direito de férias calculado em 1 ano após a data-base e limite calculado em 11 meses após o direito.',
                            'Após lançamento, o fim do período aquisitivo passa a ser a nova data-base para próximos cálculos.',
                        ],
                    },
                    {
                        title: 'Dashboard, Lista e Lançamento conectados ao backend',
                        details: [
                            'Dashboard com contadores de vencidas, a vencer, próximos 4 meses, próximos 2 meses e percentual com/sem abono.',
                            'Lista com filtros de unidade, função e limite; colunas de nome, função, direito e limite.',
                            'Lançamento com abono (20 dias) e sem abono (30 dias), data fim automática e período aquisitivo editável.',
                        ],
                    },
                    {
                        title: 'Ajuste de experiência no formulário de lançamento',
                        details: [
                            'Campo de colaborador no Lançar Férias passou a abrir opções em dropdown ao clique para seleção direta.',
                            'Campo agora também permite digitação para filtro dinâmico de nomes (ex.: "Ad" exibe opções como Adair).',
                        ],
                    },
                ],
            },
            {
                panel: 'Log',
                items: [
                    {
                        title: 'Estrutura em duas frentes',
                        details: [
                            'Menu lateral alterado para exibir apenas “Log”.',
                            'Tela de Log com alternância entre Log de Ações e Update Log.',
                            'Update Log iniciado com lista rolável por dia e tópicos das alterações.',
                        ],
                    },
                    {
                        title: 'Regra operacional de atualização contínua',
                        details: [
                            'Definido padrão de registrar no Update Log as entregas do dia ao final de cada pedido concluído.',
                            'Definido padrão de manter o mesmo título do painel (ex.: Gestão de Fretes) e apenas acrescentar subtópicos quando houver novas alterações no mesmo painel.',
                            'Mantida rotina de publicar alterações na hospedagem ao final das implementações.',
                        ],
                    },
                    {
                        title: 'Correção de backup e reversão da conta Demo',
                        details: [
                            'Corrigido erro de backup nas configurações substituindo chamadas de path que falhavam no ambiente por caminhos base estáveis do projeto.',
                            'Removida integralmente a classe/role Demo do sistema e revertida a migration correspondente no banco principal para evitar qualquer risco operacional.',
                        ],
                    },
                ],
            },
        ],
    },
];

function formatDate(iso: string): string {
    return formatDateTimeBR(iso, iso);
}

function ChangesCell({
    changes,
    event,
}: {
    changes: ActivityChange | null;
    event: string | null;
}) {
    if (!changes) return <span className="text-muted-foreground">—</span>;

    if (event === 'created' && changes.attributes) {
        const entries = Object.entries(changes.attributes);
        if (entries.length === 0)
            return <span className="text-muted-foreground">—</span>;

        return (
            <div className="flex flex-wrap gap-1">
                {entries.map(([key, val]) => (
                    <span
                        key={key}
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                    >
                        {key}:{' '}
                        <span className="text-green-700 dark:text-green-400">
                            {String(val ?? '')}
                        </span>
                    </span>
                ))}
            </div>
        );
    }

    if (event === 'updated' && changes.old && changes.attributes) {
        const keys = Object.keys(changes.attributes);
        if (keys.length === 0)
            return <span className="text-muted-foreground">—</span>;

        return (
            <div className="flex flex-col gap-0.5">
                {keys.map((key) => (
                    <span key={key} className="font-mono text-[11px]">
                        <span className="font-semibold">{key}:</span>{' '}
                        <span className="text-red-600 line-through">
                            {String(changes.old![key] ?? '')}
                        </span>
                        {' → '}
                        <span className="text-green-700 dark:text-green-400">
                            {String(changes.attributes![key] ?? '')}
                        </span>
                    </span>
                ))}
            </div>
        );
    }

    return <span className="text-muted-foreground">—</span>;
}

export default function ActivityLogPage() {
    const [mode, setMode] = useState<'actions' | 'updates'>('actions');
    const [items, setItems] = useState<ActivityLogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [notification, setNotification] = useState<{
        type: 'success' | 'error';
        message: string;
    } | null>(null);

    const [search, setSearch] = useState('');
    const debouncedSearch = useDebouncedValue(search, 300);
    const [logName, setLogName] = useState('');
    const [event, setEvent] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [appliedFilters, setAppliedFilters] = useState({
        search: '',
        log_name: '',
        event: '',
        date_from: '',
        date_to: '',
        page: 1,
    });

    useEffect(() => {
        if (mode !== 'actions') return;

        let cancelled = false;

        async function load() {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                params.set('per_page', '25');
                params.set('page', String(appliedFilters.page));
                if (appliedFilters.search)
                    params.set('search', appliedFilters.search);
                if (appliedFilters.log_name)
                    params.set('log_name', appliedFilters.log_name);
                if (appliedFilters.event)
                    params.set('event', appliedFilters.event);
                if (appliedFilters.date_from)
                    params.set('date_from', appliedFilters.date_from);
                if (appliedFilters.date_to)
                    params.set('date_to', appliedFilters.date_to);

                const res = await apiGet<ActivityLogResponse>(
                    `/activity-log?${params.toString()}`,
                );
                if (!cancelled) {
                    setItems(res.data);
                    setCurrentPage(res.current_page);
                    setLastPage(res.last_page);
                    setTotal(res.total);
                }
            } catch (err) {
                if (!cancelled) {
                    const msg =
                        err instanceof ApiError
                            ? err.message
                            : 'Erro ao carregar log.';
                    setNotification({ type: 'error', message: msg });
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void load();
        return () => {
            cancelled = true;
        };
    }, [appliedFilters, mode]);

    useEffect(() => {
        if (mode !== 'actions') return;

        setAppliedFilters((previous) => {
            if (previous.search === debouncedSearch) {
                return previous;
            }

            return {
                ...previous,
                search: debouncedSearch,
                page: 1,
            };
        });
    }, [debouncedSearch, mode]);

    function applyFilters() {
        setAppliedFilters({
            search,
            log_name: logName,
            event,
            date_from: dateFrom,
            date_to: dateTo,
            page: 1,
        });
    }

    function clearFilters() {
        setSearch('');
        setLogName('');
        setEvent('');
        setDateFrom('');
        setDateTo('');
        setAppliedFilters({
            search: '',
            log_name: '',
            event: '',
            date_from: '',
            date_to: '',
            page: 1,
        });
    }

    function goToPage(page: number) {
        setAppliedFilters((prev) => ({ ...prev, page }));
    }

    return (
        <AdminLayout
            title="Log"
            active="activity-log"
            module="home"
        >
            {notification && (
                <Notification
                    variant={notification.type}
                    message={notification.message}
                />
            )}

            <div className="space-y-4">
                <div>
                    <h2 className="text-xl font-semibold">Log</h2>
                    <p className="text-sm text-muted-foreground">
                        {mode === 'actions'
                            ? 'Histórico completo de ações realizadas no sistema.'
                            : 'Registro de atualizações do produto por dia.'}
                        {mode === 'actions' && total > 0 && !loading && (
                            <span className="ml-1 font-medium text-foreground">
                                {total} registros encontrados.
                            </span>
                        )}
                    </p>
                </div>

                <div className="flex gap-2">
                    <Button
                        type="button"
                        size="sm"
                        variant={mode === 'actions' ? 'default' : 'outline'}
                        onClick={() => setMode('actions')}
                    >
                        Log de Ações
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant={mode === 'updates' ? 'default' : 'outline'}
                        onClick={() => setMode('updates')}
                    >
                        Update Log
                    </Button>
                </div>

                {mode === 'updates' ? (
                    <div className="max-h-[68vh] space-y-4 overflow-y-auto rounded-lg border p-3">
                        {updateLogTimeline.map((day) => (
                            <div key={day.dateLabel} className="space-y-3 rounded-lg border bg-card p-4">
                                <h3 className="text-base font-semibold">{day.dateLabel}</h3>

                                <div className="space-y-4">
                                    {day.sections.map((section) => (
                                        <div key={section.panel} className="space-y-2">
                                            <h4 className="text-sm font-semibold text-foreground">{section.panel}</h4>

                                            <div className="space-y-2">
                                                {section.items.map((item) => (
                                                    <div key={item.title} className="rounded-md border bg-muted/20 p-3">
                                                        <p className="text-sm font-medium">{item.title}</p>
                                                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                                                            {item.details.map((detail) => (
                                                                <li key={detail}>{detail}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : null}

                {mode === 'actions' ? (
                    <>
                        <div className="flex flex-wrap gap-2">
                            <Input
                                placeholder="Buscar por usuário ou ação..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                                className="w-52"
                            />
                            <Select
                                value={logName || '_all'}
                                onValueChange={(v) => setLogName(v === '_all' ? '' : v)}
                            >
                                <SelectTrigger className="w-36">
                                    <SelectValue placeholder="Módulo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="_all">
                                        Todos os módulos
                                    </SelectItem>
                                    <SelectItem value="default">Entrevistas</SelectItem>
                                    <SelectItem value="frete">Frete</SelectItem>
                                    <SelectItem value="folha">Folha</SelectItem>
                                    <SelectItem value="cadastro">Cadastro</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select
                                value={event || '_all'}
                                onValueChange={(v) => setEvent(v === '_all' ? '' : v)}
                            >
                                <SelectTrigger className="w-36">
                                    <SelectValue placeholder="Evento" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="_all">
                                        Todos os eventos
                                    </SelectItem>
                                    <SelectItem value="created">Criação</SelectItem>
                                    <SelectItem value="updated">Atualização</SelectItem>
                                    <SelectItem value="deleted">Exclusão</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-36"
                                title="Data inicial"
                            />
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-36"
                                title="Data final"
                            />
                            <Button size="sm" onClick={applyFilters}>
                                Filtrar
                            </Button>
                            <Button size="sm" variant="outline" onClick={clearFilters}>
                                Limpar
                            </Button>
                        </div>

                        <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full min-w-[900px] table-fixed text-sm">
                                <thead className="bg-muted/40">
                                    <tr>
                                        <th className="w-[160px] px-4 py-3 text-left font-medium">
                                            Data / Hora
                                        </th>
                                        <th className="w-[140px] px-4 py-3 text-left font-medium">
                                            Usuário
                                        </th>
                                        <th className="w-[80px] px-3 py-3 text-left font-medium">
                                            Módulo
                                        </th>
                                        <th className="w-[80px] px-3 py-3 text-left font-medium">
                                            Evento
                                        </th>
                                        <th className="w-[200px] px-4 py-3 text-left font-medium">
                                            Descrição
                                        </th>
                                        <th className="w-[240px] px-4 py-3 text-left font-medium">
                                            Alterações
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-4 py-8 text-center text-muted-foreground"
                                            >
                                                <span className="inline-flex items-center gap-2">
                                                    <LoaderCircle className="size-4 animate-spin" />
                                                    Carregando...
                                                </span>
                                            </td>
                                        </tr>
                                    ) : items.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-4 py-8 text-center text-muted-foreground"
                                            >
                                                Nenhuma ação registrada ainda.
                                            </td>
                                        </tr>
                                    ) : (
                                        items.map((item) => (
                                            <tr
                                                key={item.id}
                                                className="border-t align-top transition-colors hover:bg-muted/20"
                                            >
                                                <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                                                    {formatDate(item.created_at)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="block truncate text-sm leading-5 font-medium">
                                                        {item.causer?.name ?? (
                                                            <span className="text-muted-foreground italic">
                                                                sistema
                                                            </span>
                                                        )}
                                                    </span>
                                                    {item.causer?.email && (
                                                        <span className="block truncate text-[11px] text-muted-foreground">
                                                            {item.causer.email}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[11px]"
                                                    >
                                                        {logNameLabel[
                                                            item.log_name ?? ''
                                                        ] ??
                                                            item.log_name ??
                                                            '—'}
                                                    </Badge>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <Badge
                                                        variant={
                                                            eventVariant[
                                                                item.event ?? ''
                                                            ] ?? 'secondary'
                                                        }
                                                        className="text-[11px]"
                                                    >
                                                        {eventLabel[item.event ?? ''] ??
                                                            item.event ??
                                                            '—'}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    {item.description}
                                                    {item.subject_type &&
                                                        item.subject_id && (
                                                            <span className="block text-[11px] text-muted-foreground">
                                                                {item.subject_type} #
                                                                {item.subject_id}
                                                            </span>
                                                        )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <ChangesCell
                                                        changes={item.changes}
                                                        event={item.event}
                                                    />
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {lastPage > 1 && (
                            <div className="flex items-center justify-between gap-4">
                                <p className="text-sm text-muted-foreground">
                                    Página {currentPage} de {lastPage}
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={currentPage <= 1}
                                        onClick={() => goToPage(currentPage - 1)}
                                    >
                                        Anterior
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={currentPage >= lastPage}
                                        onClick={() => goToPage(currentPage + 1)}
                                    >
                                        Próximo
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                ) : null}
            </div>
        </AdminLayout>
    );
}
