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
        dateLabel: 'Segunda-Feira, 27/04/2026',
        sections: [
            {
                panel: 'Plataforma',
                items: [
                    {
                        title: 'Sidebar v4.4: submenus por hover agora expandem para baixo, sem painel lateral à direita',
                        details: [
                            'Navegação da sidebar foi ajustada para abrir páginas filhas abaixo do item pai quando houver hover/foco, em vez de abrir um painel flutuante à direita.',
                            'Com a expansão inline, os itens seguintes passam a ser deslocados para baixo automaticamente enquanto o submenu estiver aberto, seguindo o fluxo visual esperado da operação.',
                            'Comportamento foi aplicado no layout desktop padrão e no modo foco, reduzindo largura efetiva do menu e eliminando barra horizontal causada por flyout lateral.',
                            'Ao sair do hover dos itens pai/filhos, o submenu recolhe e a ordem da lista retorna ao estado original.',
                        ],
                    },
                ],
            },
        ],
    },
    {
        dateLabel: 'Quinta-Feira, 09/04/2026',
        sections: [
            {
                panel: 'Plataforma',
                items: [
                    {
                        title: 'Segurança e Integrações v4.2: sessões por token, incidentes, service accounts, webhooks e aprovação dupla na folha',
                        details: [
                            'Sessões API evoluíram para rastreamento por token com metadados de IP/user-agent/última atividade, incluindo endpoint para gestão de sessões ativas.',
                            'Monitoramento de segurança passou a registrar incidentes internos automaticamente em cenários de bloqueio por atividade suspeita e picos de erros 5xx.',
                            'Gateway de integrações recebeu autenticação por `service accounts` e base de webhooks outbound com assinatura HMAC, retries em fila e trilha de entregas.',
                            'Fluxo financeiro da folha ganhou aprovação dupla por token para lançamentos em lote de maior impacto, com retorno assíncrono e governança operacional.',
                            'Publicada superfície técnica adicional para OpenAPI e assistente de restore de backup, ampliando observabilidade e operação em ambiente de produção.',
                        ],
                    },
                    {
                        title: 'Estabilização pós-entrega: criptografia de dados sensíveis e robustez de testes com cache de rotas limpo',
                        details: [
                            'Modelo de colaboradores foi corrigido para garantir criptografia consistente de CPF com `cpf_hash` normalizado, eliminando regressões de decrypt em leitura.',
                            'Criada migração de saneamento para criptografar dados legados sensíveis em colaboradores/entrevistas sem dupla criptografia e com recomputação de hash de CPF.',
                            'Middleware de atividade de token foi endurecido para ignorar tokens transitórios/mock e evitar erro 500 em cenários de teste e autenticação simulada.',
                            'Base de testes agora remove cache de rotas no setup para impedir 404 falso-positivo após `optimize`, mantendo a suíte determinística em CI/local.',
                            'Validação final concluída com build, migrations, cache rebuild e suíte completa verde (`157 passed`).',
                        ],
                    },
                    {
                        title: 'Navegação principal v4.3: sidebar com submenu por hover mantendo acesso direto ao item pai',
                        details: [
                            'Sidebar da tela principal passou a abrir submenus no hover/foco em desktop, mantendo navegação rápida para ações internas de cada módulo.',
                            'Itens principais continuam clicáveis para entrada direta no painel pai (ex.: `Gestão de Fretes`), sem bloquear o fluxo antigo de acesso.',
                            'Versão mobile ganhou exibição hierárquica inline dos filhos no próprio menu para reduzir troca de contexto e acelerar acesso por toque.',
                            'Filtro de permissões foi aplicado também nos links filhos para manter consistência de visibilidade por perfil/cargo.',
                        ],
                    },
                ],
            },
            {
                panel: 'Gestão de Fretes',
                items: [
                    {
                        title: 'Dashboard de Fretes v4.3: filtros compactos, 12 gráficos por unidade e limpeza de cards redundantes',
                        details: [
                            'Linha de filtros foi condensada para operação rápida em uma única faixa, unindo competência mês/ano, unidade e intervalo de datas com ação de limpar período.',
                            'Duas fileiras de cards KPI e o bloco `Destaques rápidos` foram removidos para liberar altura útil e focar no que orienta decisão diária.',
                            'Adicionados 12 gráficos de colunas por unidade em grade responsiva (3x4 em telas largas), cobrindo métricas de frete, produtividade e eficiência operacional.',
                            'Resumo mensal por unidade foi preservado com retirada apenas do card `Frete líquido`, conforme regra operacional solicitada.',
                            'Tabela diária de fretes foi mantida com paginação incremental (`Carregar mais lançamentos`) para suportar períodos longos.',
                        ],
                    },
                ],
            },
        ],
    },
    {
        dateLabel: 'Terça-Feira, 07/04/2026',
        sections: [
            {
                panel: 'Gestão de Fretes',
                items: [
                    {
                        title: 'Backup v3.8: exportação reforçada para cobertura total de banco e arquivos',
                        details: [
                            'Geração de backup foi ajustada para incluir a pasta `storage` completa (não apenas `storage/app/public`), cobrindo uploads, logs e artefatos necessários para restauração integral.',
                            'Dump SQL passou a incluir também objetos de banco além das tabelas/dados: views, triggers, routines (procedures/functions) e events quando disponíveis no MySQL.',
                            'No modo SQLite, o dump passou a adicionar também SQL de índices e triggers para preservar melhor o comportamento estrutural na restauração.',
                            'Pasta de backups gerados foi mantida fora do pacote (`storage/app/private/backups`) para evitar recursão e crescimento artificial do ZIP.',
                        ],
                    },
                    {
                        title: 'Gestão de Multas v3.9: lançamento de notificações, campo Hora e conversão direta para multa',
                        details: [
                            'Criada nova tela na sidebar `Lançar Notificação`, com formulário específico para pré-multa: Data, Hora, Placa, Infração, Descrição, Nº Auto de Infração, Órgão Atuador e Status.',
                            'Campo `Hora` passou a existir também no lançamento e listagem de multas, mantendo rastreabilidade operacional de quando o evento ocorreu.',
                            'Lista de multas recebeu alternância por botões entre `Multas` e `Notificações`, separando claramente os dois fluxos no operacional.',
                            'Notificações não entram no dashboard e indicadores de multas, evitando distorção dos gráficos enquanto o caso ainda está em fase prévia.',
                            'Na aba de notificações, cada linha agora possui ações de `Editar`, `Excluir` e `Transformar em multa`.',
                            'Ação `Transformar em multa` abre a tela de Lançar Multa já pré-preenchida com dados da notificação e permite completar os campos extras de multa (valor, vencimento, culpa, motorista etc.) antes de salvar.',
                        ],
                    },
                    {
                        title: 'Entrevistas/Pagamentos v4.0: anexos com links C/CNH/CT, observação por duplo clique e impressão com mãe na pensão',
                        details: [
                            'Na lista de `Entrevistas > Currículos`, a coluna de arquivo foi substituída por `Observação` com edição rápida por duplo clique direto na célula.',
                            'A coluna `Anexos` passou a exibir links operacionais por sigla: `C` (currículo), `CNH` e `CT`, permitindo abrir cada arquivo individualmente com um clique.',
                            'Quando existir mais de um anexo, o sistema mostra no formato `C/CNH/CT`, mantendo leitura compacta e abertura direta de cada documento.',
                            'Favicon público do domínio foi alinhado com a identidade da Kaique para evitar exibição do ícone padrão do Laravel ao abrir links diretos de arquivos.',
                            'Na impressão de pagamentos salariais, linhas de pensão agora mostram a coluna `Mãe / Beneficiária`, facilitando conferência de pagamento para a pessoa correta.',
                        ],
                    },
                    {
                        title: 'Entrevistas v4.1: filtros por função/unidade em Currículos e ajustes de desempenho geral',
                        details: [
                            'Tela de `Currículos` ganhou filtros operacionais por `Função` e `Unidade`, permitindo localizar candidatos mais rápido sem depender apenas da busca por nome.',
                            'Filtro recebeu ação `Limpar` para reset imediato de busca/função/unidade sem recarregar manualmente a página.',
                            'Carregamento de catálogos (unidades/funções) foi otimizado para ocorrer apenas uma vez ao abrir a tela, removendo chamadas repetidas a cada mudança de filtro.',
                            'Backend da listagem de currículos passou a validar parâmetros de filtro e limite de entrada para evitar consultas custosas com payload inválido.',
                            'Banco recebeu índices para combinações de `status + função` e `status + unidade`, acelerando listagens filtradas e reduzindo travamentos em bases maiores.',
                            'Na lista de pagamentos, o carregamento de páginas adicionais foi otimizado de sequencial para paralelo, reduzindo tempo de espera e sensação de travamento em períodos com muitos lançamentos.',
                        ],
                    },
                ],
            },
        ],
    },
    {
        dateLabel: 'Segunda-Feira, 06/04/2026',
        sections: [
            {
                panel: 'Gestão de Fretes',
                items: [
                    {
                        title: 'Programação v3: importação XLSX por colunas fixas (A..J), tratamento de buracos e tabela operacional para alocação manual por viagem',
                        details: [
                            'Importação da Programação foi ajustada para ler planilha no formato operacional fixo por coluna: A Data, B Aviário, C Cidade, D Distância, E Equipe, F Aves, G Nº Carga, H Saída prevista, I Carregamento e J Chegada prevista.',
                            'Regra de qualidade da importação foi aplicada para ignorar linhas com buracos: qualquer linha com coluna A vazia, coluna B vazia ou Aves igual a 0 é automaticamente desconsiderada.',
                            'Fluxo de importação passou a exigir unidade selecionada no painel para vincular as viagens importadas ao contexto operacional correto.',
                            'Base de programação recebeu novos campos estruturados para refletir o Excel enviado pela operação: aviário, cidade, distância, equipe, aves, número da carga e horário de carregamento.',
                            'Tela principal da Programação foi evoluída de board em cards para tabela horizontal de viagens, exibindo todas as colunas importadas e mantendo foco em leitura rápida para escala diária.',
                            'Cada linha da tabela agora possui área de alocação manual para motorista e caminhão (select + suporte a arrastar e soltar), além de edição de horários e botão de salvar por viagem.',
                        ],
                    },
                    {
                        title: 'Dashboard de Multas: pacote da próxima etapa de performance aplicado (renderização sob demanda e proteção contra resposta antiga)',
                        details: [
                            'Gráficos do Dashboard de Multas passaram a usar carregamento sob demanda por visibilidade na tela (lazy mount), reduzindo custo de render inicial em períodos grandes.',
                            'Chamadas de filtro agora possuem proteção contra respostas antigas: se o usuário trocar filtros rapidamente, apenas a resposta mais recente atualiza a tela.',
                            'Ajuste reduz travamentos perceptíveis durante navegação e evita sobrescrita visual por requisição fora de ordem em cenários de latência.',
                        ],
                    },
                    {
                        title: 'Programação v3.1: correção de importação XLSX real da operação + fluxo Ler XLSX e Salvar tabela do dia',
                        details: [
                            'Parser de importação da Programação foi reforçado para aceitar variações reais da planilha operacional (incluindo formatos de data e números com separador de milhar).',
                            'Fluxo de importação virou duas etapas para controle operacional: primeiro `Ler XLSX` (pré-visualização) e depois `Salvar tabela do dia` para confirmar gravação no sistema.',
                            'Resumo de prévia agora mostra totais de linhas lidas, válidas, ignoradas e com erro, facilitando entendimento quando a planilha tiver buracos ou inconsistências.',
                            'Motivos de linhas ignoradas passaram a ser retornados pela API (ex.: data/aviário vazio e aves <= 0), evitando mensagem genérica sem contexto.',
                        ],
                    },
                    {
                        title: 'Programação v3.2: tabela pós-importação agora abre automaticamente no dia importado',
                        details: [
                            'Após clicar em `Salvar tabela do dia`, o sistema passou a ajustar automaticamente o filtro de data para o dia predominante da importação.',
                            'Com isso, a tabela de viagens não fica mais vazia por diferença de data entre filtro atual e planilha recém-importada.',
                            'Resposta da API de importação foi enriquecida com `data_sugerida` e lista de datas importadas para apoiar a navegação automática no frontend.',
                        ],
                    },
                    {
                        title: 'Programação v3.3: fallback automático de data no dashboard quando o dia filtrado estiver vazio',
                        details: [
                            'Dashboard da Programação passou a aplicar fallback automático para a última data com viagens da unidade quando o filtro atual não tiver registros.',
                            'A resposta de filtros retorna a data efetiva utilizada no carregamento, mantendo frontend e backend sincronizados e evitando tabela vazia indevida.',
                            'Com isso, o operador sempre visualiza a tabela de viagens disponível mais recente em vez da mensagem `Nenhuma viagem cadastrada` quando já existem dados importados.',
                        ],
                    },
                    {
                        title: 'Programação v3.4: normalização de datas ISO no fallback para garantir abertura automática da tabela',
                        details: [
                            'Normalização de data no backend foi reforçada para converter corretamente timestamps ISO retornados pelo banco em `YYYY-MM-DD` antes de aplicar filtro.',
                            'Correção evita cenário em que existiam viagens importadas (ex.: 07/04) mas o filtro permanecia em outro dia e a tabela continuava vazia.',
                            'Diagnóstico validado em base real: viagens importadas foram confirmadas no banco por unidade/data e passam a aparecer com ajuste automático do filtro.',
                        ],
                    },
                    {
                        title: 'Programação v3.5: correção definitiva de filtro por data com coluna datetime (tabela volta a carregar viagens importadas)',
                        details: [
                            'Causa raiz identificada em produção local: coluna `data_viagem` estava persistindo com hora (`YYYY-MM-DD 00:00:00`), e filtros com igualdade exata em `YYYY-MM-DD` retornavam zero viagens no dashboard.',
                            'Consultas críticas da Programação foram corrigidas para `whereDate` no backend (dashboard, vínculos de escala e deduplicação na importação), garantindo compatibilidade com storage date ou datetime.',
                            'Validação ponta a ponta confirmou a correção no endpoint real: para unidade 1 com filtro 06/04, o sistema agora resolve para 07/04 e retorna viagens normalmente.',
                            'Efeito colateral resolvido: reimportações deixam de falhar no match por data e passam a atualizar corretamente os registros existentes em vez de multiplicar linhas.',
                            'Frontend do dashboard recebeu proteção contra resposta antiga (stale response guard), impedindo que uma requisição anterior sobrescreva a tabela após importação ou troca rápida de filtros.',
                        ],
                    },
                    {
                        title: 'Programação v3.6: limpar tabela do dia, layout compacto sem rolagem lateral, KM corrigido e regra operacional da saída no dia anterior',
                        details: [
                            'Backend recebeu novo endpoint `POST /api/programming/clear-day-table` para remover todas as viagens da unidade/data selecionada em operação de correção rápida.',
                            'Tela da Programação ganhou ação `Limpar tabela do dia` com confirmação e recarga automática, permitindo refazer importação quando houver lançamento incorreto.',
                            'Tabela de viagens foi redesenhada para versão compacta com colunas consolidadas e `table-fixed`, reduzindo largura e eliminando dependência de rolagem horizontal.',
                            'Áreas de arrastar e soltar motorista/caminhão ficaram explícitas com borda pontilhada e mensagem contextual (`arraste`/`solte`), mantendo select como fallback operacional.',
                            'Numeração sequencial por dia foi adicionada no retorno da API (`ordem_no_dia`) e exibida na grade para refletir ordem real 1..N conforme importação do dia.',
                            'Regra de negócio implementada para viagens 1 a 10: quando saída prevista for a partir de 20:30, a saída operacional é calculada no dia anterior e sinalizada na interface.',
                            'Leitura de distância na importação XLSX foi reforçada para priorizar valor formatado da célula e sanitizar sufixos como `km`, corrigindo casos em que a coluna vinha zerada.',
                        ],
                    },
                    {
                        title: 'Programação v3.7: modal bonito de limpeza, tabela estilo Excel ultra-compacta, autosave e painéis flutuantes redimensionáveis',
                        details: [
                            'Confirmação de `Limpar tabela do dia` deixou de usar alerta nativo e agora usa modal customizado com contexto da data/unidade e feedback visual mais claro para operação.',
                            'Grade operacional foi enxugada para fluxo de despacho rápido: linhas mais baixas, zebra para distinguir viagens, e remoção das colunas não essenciais no uso diário (data, aves e equipe).',
                            'Campos de motorista e caminhão passaram a aceitar digitação com correspondência flexível por prefixo e similaridade (ex.: `Adai` resolve para `Adair`) sem depender apenas de seleção manual.',
                            'Navegação por teclado foi acelerada: `Enter`, `ArrowDown` e `ArrowUp` aplicam a alocação da linha e movem foco para a próxima/anterior viagem, no mesmo padrão de planilha.',
                            'Salvamento por viagem virou automático após alocação/ajuste de horário, com estado por linha (`Salvando`, erro de validação ou horário do último autosave) e sem botão manual de salvar.',
                            'Cartões de motoristas e caminhões foram convertidos em janelas flutuantes no desktop, com arrastar para mover, redimensionamento livre e empilhamento por foco (z-index).',
                            'Filtros operacionais dos painéis foram padronizados para `Todos`, `Disponíveis` e `Iniciadas`, usando status calculado por carga de trabalho (`Disponível`, `Viagem Iniciada`, `Encerrado`).',
                            'Backend recebeu persistência de ordem original de importação (`ordem_importacao`) para manter sequência operacional estável no dia e suportar regra da noite anterior expandida de 1..10 para 1..20.',
                        ],
                    },
                ],
            },
        ],
    },
    {
        dateLabel: 'Sexta-Feira, 03/04/2026',
        sections: [
            {
                panel: 'Gestão de Fretes',
                items: [
                    {
                        title: 'Novo painel Gestão de Multas completo: Dashboard, Lançar, Lista + Infrações no Cadastro e integração com Descontos',
                        details: [
                            'Criado novo painel `Gestão de Multas` com três páginas na sidebar: Dashboard, Lançar Multas e Lista de Multas, seguindo o mesmo padrão visual e de navegação dos demais painéis.',
                            'Home foi ajustada para acomodar sete painéis com cards menores em grade de quatro colunas no desktop, mantendo leitura operacional limpa.',
                            'Dashboard de multas foi entregue com filtros por período aberto (início/fim) e unidade, cartões de quantidade/valor e gráficos por infração, culpa, tipo de valor, status, placa e motorista.',
                            'Tela de lançamento passou a cobrir todos os campos operacionais solicitados (data, placa, infração, descrição, nº auto, órgão, motorista, indicado condutor, culpa, valor, tipo valor, vencimento, status e descontar).',
                            'Órgão autuador ganhou fluxo de auto cadastro: ao digitar um órgão inexistente, o sistema abre modal de confirmação e, ao confirmar, já cadastra o órgão e conclui o lançamento da multa.',
                            'Foi criada em `Cadastro` a nova página `Infrações` para manutenção do catálogo de infrações (nome e status), usado diretamente no lançamento de multas.',
                            'Lista de multas foi implementada com as colunas operacionais completas e ordenação em todos os campos, além de filtros por placa, motorista, infração, culpa, status e órgão.',
                            'Integração com `Pagamentos > Descontos`: quando lançar multa com culpa do motorista e descontar = sim, o sistema redireciona para Descontos com motorista, valor e data pré-preenchidos (mantendo campos editáveis antes de salvar).',
                            'Backend recebeu novas tabelas/modelos/controladores de multas, catálogo de órgãos e infrações, permissões dedicadas de sidebar/ações e rotas web/api para o módulo.',
                        ],
                    },
                    {
                        title: 'Novo 6º painel Programação (MVP): importação XLSX base, escalação motorista↔caminhão e jornada mensal',
                        details: [
                            'Criado novo módulo `Programação` como sexto painel do sistema, com rota web dedicada e acesso na Home e sidebar respeitando permissões.',
                            'Catálogo de permissões foi ampliado com entradas de sidebar e ações para Programação (`dashboard`, `importação` e `escalação`), mantendo governança por perfil.',
                            'Backend ganhou API base de programação com endpoints para dashboard operacional, preview/importação de planilha XLSX e gravação de escala por viagem.',
                            'Importação XLSX da base foi implementada com leitura flexível de cabeçalho, validação de unidade/data e criação/atualização de viagens programadas.',
                            'Escalação valida conflitos de motorista e caminhão na mesma data, além de garantir aderência de unidade antes de salvar.',
                            'Nova tela `Programação de Viagens` foi entregue com seleção de unidade/data, upload XLSX, grid de viagens, seleção de motorista/caminhão e ação de salvar escala.',
                            'Painel exibe também base de jornada mensal por motorista e blocos de disponibilidade diária (motoristas e caminhões) para apoiar a tomada de decisão operacional.',
                            'Home passou a exibir card de Programação com métricas do dia (viagens previstas, sem escala, motoristas disponíveis e caminhões disponíveis).',
                            'Estrutura de dados base foi criada com migrations e modelos específicos para viagens programadas e escalações.',
                        ],
                    },
                    {
                        title: 'Programação v2: board de arrastar/soltar + regra de interjornada (11h) + horas extras diárias',
                        details: [
                            'Tela de Programação foi redesenhada para operação por `drag and drop`: motorista e caminhão agora são cards arrastáveis para slots dedicados em cada viagem.',
                            'Cada viagem passou a exibir campos de horário (`saída` e `chegada/fim prevista`) diretamente no board, permitindo ajuste operacional sem sair da tela.',
                            'Importação XLSX foi ampliada para reconhecer horários de início/fim (além de jornada), mantendo compatibilidade com planilhas sem essas colunas.',
                            'Regra de interjornada mínima foi implementada no backend: ao tentar escalar com menos de 11h de descanso entre término anterior e início atual, o sistema bloqueia e avisa.',
                            'Base de jornada do painel foi ajustada para foco diário: exibe horas trabalhadas no dia e horas extras após 8h, removendo o antigo conceito de saldo disponível mensal.',
                            'Filtro de unidade agora aceita visão consolidada (`todas as unidades`) para evitar percepção de “faltando motoristas” quando o usuário precisa escalar sem recorte local.',
                            'Board destaca visualmente viagens com alerta de interjornada para rápida identificação de conflito operacional no planejamento do dia seguinte.',
                        ],
                    },
                    {
                        title: 'Programação v2.1: filtro estrito de motoristas por unidade + organização da busca e linguagem operacional',
                        details: [
                            'Backend do dashboard passou a considerar somente colaboradores com função de motorista, removendo funções administrativas (ex.: gerente de frota) da lista de arraste.',
                            'Escopo de listagem voltou a respeitar unidade selecionada como referência principal no painel, reduzindo ruído operacional na escala diária.',
                            'Painel de motoristas ganhou filtros rápidos (`Disponíveis`, `Alocados`, `Todos`) para facilitar localizar nomes com agilidade em operação.',
                            'Mensagens de ajuda no topo dos blocos deixam explícito o gesto de uso (`clique, segure e arraste`) para reduzir dúvida no time.',
                            'Etiqueta `Sem CNH` foi removida do card de motorista conforme solicitação e textos foram ajustados para português com acentuação correta (ex.: `Caminhões`).',
                        ],
                    },
                    {
                        title: 'Navegação por seta padronizada + ordem alfabética acento-insensível em listas operacionais',
                        details: [
                            'Tela de Lançar Pagamentos foi corrigida para que navegação por setas (`↑/↓/←/→`) siga a mesma ordem exibida na grade (ordenação visual por nome), evitando saltos para colaboradores fora de contexto.',
                            'Autocomplete do Relatório por Colaborador deixou de usar debounce na filtragem local, eliminando atraso entre digitação e navegação por seta que levava a seleção de itens indevidos.',
                            'Busca e ordenação de colaboradores/cidades/placas/aviários foram padronizadas para comparação acento-insensível (`e` = `é`) e ordem alfabética consistente no frontend.',
                            'Autocompletes de Frete e Entrevista passaram a usar o mesmo motor de normalização textual para manter comportamento uniforme entre módulos.',
                        ],
                    },
                    {
                        title: 'Relatório por Colaborador (Pagamentos): cálculo mensal consolidado e timeline limpa',
                        details: [
                            'Resumo mensal do Relatório por Colaborador passou a consolidar `salário + pensão - descontos` por competência, refletindo o valor real devido no mês.',
                            'Timeline foi convertida para visão mensal consolidada com composição explícita de `Salário`, `Pensão`, `Descontos` e `Total consolidado do mês`.',
                            'Indicador de `Variação` foi removido da linha do tempo conforme solicitado para foco no valor consolidado operacional.',
                            'Observações técnicas em JSON (ex.: `dias_uteis`, `pensoes`) deixaram de ser exibidas na interface, mantendo o histórico visual limpo.',
                            'Tela de Programação recebeu revisão de textos em português com correções de acentuação e termos operacionais (ex.: Programação, caminhão, horários, importação, disponível).',
                        ],
                    },
                    {
                        title: 'Ajuste fino no Relatório por Colaborador: descontos somando no valor devido + linha do tempo apenas com meses lançados',
                        details: [
                            'Cálculo mensal foi ajustado para o valor devido considerar soma de `salário líquido + pensão + descontos`, de forma que descontos elevem o bruto devido no mês em vez de reduzir.',
                            'No relatório, `descontos` agora consolida tanto lançamentos de desconto quanto parcelas de empréstimo do colaborador na competência.',
                            'Regra de empréstimo no relatório foi corrigida para aplicar parcelas restantes desde a competência de início do empréstimo, evitando sumiço de desconto em meses lançados.',
                            'Linha do tempo deixou de listar competências sem lançamento (meses zerados/futuros), exibindo somente meses realmente processados.',
                            'Composição textual da timeline foi refinada para evidenciar `Salário líquido`, `Descontos`, `Salário bruto` e `Pensão`, reduzindo ambiguidade de leitura operacional.',
                        ],
                    },
                ],
            },
        ],
    },
    {
        dateLabel: 'Quinta-Feira, 02/04/2026',
        sections: [
            {
                panel: 'Gestão de Fretes',
                items: [
                    {
                        title: 'Pagamentos/Currículos: ações por ícone, desconto parcelado corrigido, impressão enxuta com totais e aniversariantes dentro de Colaboradores',
                        details: [
                            'Tela de Currículos foi ajustada para ações visuais sem texto: recusar com ícone X, editar com ícone de lápis e excluir com lixeira vermelha.',
                            'Currículos agora permitem edição de nome/telefone/função/unidade e exclusão direta (quando não vinculados a entrevista), mantendo fluxo mais rápido no operacional.',
                            'Cálculo de desconto parcelado na prévia da folha foi corrigido para iniciar pela competência correta quando não há data de referência preenchida, evitando desconto total indevido em um único mês.',
                            'Impressão de benefícios/extras passou a mostrar somente colunas realmente lançadas no pagamento (sem colunas zeradas não selecionadas) e ganhou linha final com soma por coluna em negrito.',
                            'Exportação de benefícios por lançamento no Excel foi ajustada para padrão VR/VA: coluna `VA` agora consolida VT + Cesta Básica.',
                            'Aniversariantes foi integrado dentro de `Cadastro > Colaboradores` (não mais como item separado na sidebar), com blocos de aniversariantes de hoje e do mês na própria tela de colaboradores.',
                            'Consulta de aniversariantes foi ajustada para compatibilidade com SQLite ao ordenar por dia de nascimento, eliminando erro de função SQL em ambiente local.',
                        ],
                    },
                    {
                        title: 'Home: super dashboard por permissões + sidebar preenchida e Currículos com busca assistida em Unidade/Função',
                        details: [
                            'Home recebeu modo `Super dashboard` com opção de retorno para `Layout clássico`, permitindo reversão rápida caso o operacional prefira o modelo anterior.',
                            'Sidebar da Home deixou de ficar vazia e passou a listar atalhos dos painéis principais (Entrevistas, Pagamentos, Férias, Cadastro e Gestão de Fretes), respeitando permissões.',
                            'Super dashboard ganhou filtro de período com `1 mês`, `3 meses` e seleção de mês específico, refletindo os dados por permissão do usuário logado.',
                            'Bloco de Frete exibe cards por unidade com valor total e participação percentual no total da empresa, além de card consolidado `Kaique`.',
                            'Bloco de Férias mostra por unidade quem está de férias no momento (início/fim) e alerta de colaboradores em faixa `Urgente` na unidade.',
                            'Bloco de Pagamentos mostra matriz por unidade com colunas `Extras`, `Salário Mensal`, `Adiantamento` e linha final de `Total`.',
                            'Bloco de Entrevistas mostra total por unidade e listas de admissões e demissões recentes.',
                            'Cadastro de Currículos passou a usar Unidade/Função carregadas do cadastro (sem texto livre), com busca por digitação parcial nas opções e seleção assistida.',
                            'Campo de telefone em Currículos recebeu máscara `(11) 99999-9999` e rótulos foram corrigidos (ex.: `Função`).',
                            'Upload principal de currículo passou a aceitar `JPEG` além de `PDF/DOC/DOCX`, com validação de backend e frontend atualizadas.',
                        ],
                    },
                    {
                        title: 'Home: facelift visual moderno em Férias + Pagamentos dinâmicos por tipo cadastrado e filtro mensal dedicado',
                        details: [
                            'Visual da Home foi refinado com identidade mais moderna: hero com destaque, contrastes mais vivos e tipografia mais forte para leitura operacional rápida.',
                            'Bloco de Férias foi redesenhado com maior presença visual (cores em gradiente, cards por unidade com hierarquia clara e chips de urgência mais destacados).',
                            'Tabela de Pagamentos deixou de usar colunas fixas e passou a montar colunas dinamicamente com todos os Tipos de Pagamento cadastrados em `Cadastro > Tipos de Pagamento`.',
                            'Pagamentos recebeu seletor de competência mensal próprio dentro do card, permitindo trocar o mês da folha sem depender do filtro geral de período.',
                            'Botão de alternância para layout clássico foi retirado da interface da Home; o código do layout antigo foi mantido no arquivo para reversão futura sob demanda.',
                        ],
                    },
                    {
                        title: 'Home: ajuste fino visual pedido pelo operacional (fonte original, textos enxutos e Frete em gráfico de colunas)',
                        details: [
                            'Fonte da Home voltou ao padrão original do sistema, mantendo a paleta de cores nova aplicada anteriormente.',
                            'Texto `Visão operacional viva` foi removido do topo e os textos explicativos longos/legendas secundárias dos blocos foram enxugados para deixar o layout mais limpo.',
                            'Bloco de Frete deixou de usar cards e passou para gráfico de colunas por unidade com destaque de valor e percentual em cada coluna, seguindo o estilo visual do site.',
                            'Bloco de Férias manteve cores e destaque visual, porém com menos texto auxiliar para priorizar leitura direta da operação.',
                        ],
                    },
                    {
                        title: 'Home: gráfico de Frete refinado para estilo clean do sistema (barras proporcionais e compactas)',
                        details: [
                            'Gráfico de Frete foi refeito para eliminar efeito de barras com mesma altura: agora a altura de cada coluna escala proporcionalmente ao valor da unidade no período.',
                            'Colunas ficaram mais finas e com espaçamento reduzido, alinhando com a estética mais limpa já usada no restante do painel.',
                            'Cada coluna passou a combinar duas leituras visuais sem poluição: valor de frete em destaque e preenchimento interno proporcional ao percentual de participação da unidade.',
                            'A composição visual foi simplificada para não fugir do estilo atual do site, com bordas limpas, contraste suave e tipografia consistente.',
                        ],
                    },
                    {
                        title: 'Home: padronização final com o design global do sistema (sem visual paralelo)',
                        details: [
                            'Home foi ajustada para seguir o mesmo padrão visual das demais telas: removidos gradientes/sombras de destaque e mantida linguagem limpa de cards, bordas e tipografia padrão.',
                            'Bloco de Frete passou para layout 70/30: 70% com colunas retas e simples (sem efeitos), com altura proporcional real por valor; 30% com resumo objetivo de indicadores operacionais do frete.',
                            'Colunas de Frete ficaram mais largas e mais próximas entre si para leitura direta, mantendo visual sóbrio e consistente com o restante do produto.',
                            'Bloco de Férias foi reorganizado para usar melhor a largura disponível: unidades exibidas lado a lado em grade, reduzindo espaço ocioso e mantendo o mesmo estilo das telas de férias/listagens.',
                        ],
                    },
                    {
                        title: 'Home: reversão para versão anterior com backup do layout alternativo',
                        details: [
                            'Atendendo solicitação do operacional, a página Home foi revertida para o comportamento visual anterior.',
                            'Layout alternativo mais recente foi preservado no arquivo `resources/js/backups/home-layout-salvo-2026-04-02.tsx` para possível reaproveitamento futuro sem retrabalho.',
                        ],
                    },
                    {
                        title: 'Entrevistas/Currículos/Colaboradores: Carteira de Trabalho, vínculo opcional e herança de anexos até contratação',
                        details: [
                            'Etapa Documentos da Entrevista agora aceita anexo de `Carteira de Trabalho` (CT), além de foto do candidato e anexo da CNH, com validação de tipo/tamanho e persistência no backend.',
                            'Vínculo com currículo deixou de ser obrigatório na criação da entrevista: o fluxo permite seguir apenas com unidade de contratação e demais dados do candidato.',
                            'Cadastro de Currículos foi ampliado para aceitar anexos opcionais de CNH e CT no momento do upload do currículo, mantendo o arquivo principal do currículo como obrigatório.',
                            'Lista de Currículos ganhou coluna de status de anexos com leitura operacional (`-`, `CNH`, `CT`, `CNH/CT`), facilitando triagem rápida antes do vínculo na entrevista.',
                            'No formulário da Entrevista, ao vincular um currículo, a seção Documentos agora mostra check de anexos herdados (CNH/CT) para indicar o que já veio do currículo.',
                            'Perfil de Colaborador recebeu nova aba `Documentos` para upload/remoção e visualização de anexos de CNH e Carteira de Trabalho.',
                            'Fluxo de contratação em Próximos Passos foi reforçado para sincronizar dados e anexos da entrevista (ou do currículo vinculado, quando aplicável) no perfil do colaborador ao marcar como contratado.',
                            'Validação coberta com novos testes de API para anexos de entrevista, currículos, colaborador e cópia automática de anexos na contratação.',
                        ],
                    },
                    {
                        title: 'Currículos: cadastro com Função/Unidade/Telefone + correção de URL dos anexos',
                        details: [
                            'Tela de cadastro de Currículos passou a exigir os campos `Telefone`, `Função` e `Unidade`, além de nome e arquivo, com persistência completa no backend e banco de dados.',
                            'Lista de Currículos foi ampliada para exibir os novos dados operacionais (telefone, função e unidade), facilitando triagem do RH antes do vínculo na entrevista.',
                            'Links de anexos foram corrigidos para caminho relativo `/storage/...`, eliminando redirecionamento para host incorreto (`localhost`) quando o sistema está aberto em outro host/porta.',
                            'Correção aplicada também nos recursos de entrevista para foto/CNH/currículo, padronizando abertura de arquivos anexados no host atual.',
                            'Validação concluída com testes de API verdes, build ok, migration aplicada, caches reotimizados e checks local/público online.',
                        ],
                    },
                    {
                        title: 'Estabilização final da rodada: cache de rotas, suíte completa verde e checklist de publicação validado',
                        details: [
                            'Durante validação full (`php artisan test`) houve falha inicial de 404 nas rotas do Bob por efeito de cache antigo de rotas; problema resolvido com `php artisan optimize:clear` e reexecução da suíte.',
                            'Revalidação concluída com sucesso: suíte completa passou integralmente com `150 testes` e `730 assertions`, incluindo contratos e fluxos E2E críticos.',
                            'Checklist de publicação executado no fim da rodada: `npm run build`, `php artisan migrate --force`, `php artisan optimize:clear`, `php artisan optimize`.',
                            'Checagens de disponibilidade confirmadas: ambiente local online (`127.0.0.1:8000`), domínio público online (`app.kaiquetransportes.com.br:443`) e login local respondendo `HTTP 200`.',
                        ],
                    },
                    {
                        title: 'Currículos: nova aba dedicada (Pendentes/Passados) com vínculo na entrevista e status automático',
                        details: [
                            'Criada nova tela de Currículos no painel de Entrevistas, com abas `Pendentes` e `Passados`, busca por nome e cadastro simplificado com apenas nome do candidato + arquivo (PDF/DOC/DOCX).',
                            'Fluxo de recusa foi adicionado: ao recusar um currículo pendente, ele é movido automaticamente para `Passados` com status `Recusado`.',
                            'Formulário de Nova Entrevista/Editar Entrevista passou a ter seletor de currículo para vínculo do candidato; o upload de currículo foi removido da etapa de documentos da entrevista.',
                            'Ao vincular currículo na entrevista, o status sai de `Pendente` e passa para `Aguardando - Entrevista`; mudanças de status RH/contratação agora sincronizam automaticamente para `Aprovado - Entrevista` ou `Reprovado - Entrevista`.',
                            'Backend recebeu novo módulo de currículos (migration/model/controller/resource), permissão dedicada na sidebar e testes de API cobrindo cadastro, listagem por aba, recusa e sincronização com entrevista/próximos passos.',
                        ],
                    },
                    {
                        title: 'Idioma em pausa: painel voltou para Português fixo',
                        details: [
                            'Removida a tradução automática em runtime e os controles de troca de idioma para evitar textos inconsistentes no fluxo operacional.',
                            'Layout administrativo, login e configurações foram simplificados para operar somente em PT-BR, com formatação de números/datas estável no padrão brasileiro.',
                        ],
                    },
                    {
                        title: 'Entrevistas: anexos de Foto, CNH e Currículo no cadastro/edição',
                        details: [
                            'Nova entrevista e edição agora aceitam upload de foto do candidato, anexo da CNH e currículo diretamente no passo de Documentos e Habilitação.',
                            'API de entrevistas recebeu endpoint dedicado para sincronização de anexos, com validação de tipo/tamanho e armazenamento em diretório próprio por entrevista.',
                            'Tela de visualização passou a exibir links dos arquivos anexados e a lista de entrevistas ganhou indicador de currículo anexado/pendente.',
                        ],
                    },
                    {
                        title: 'Frete Spot: correção definitiva de máscara BR (milhar/milhão) e campos inteiros',
                        details: [
                            'Parser numérico do frontend foi reforçado para interpretar corretamente valores no formato brasileiro (ex.: 2.560 e 33.064) sem converter para formato americano.',
                            'Request backend de Spot agora normaliza números localizados antes da validação, evitando erro de integer em Aves/Cargas e distorção de valores no período.',
                            'Ajustado envio de Cargas/Aves como inteiros no payload do lançamento Spot para manter consistência com o schema do banco.',
                        ],
                    },
                    {
                        title: 'Cargas Canceladas: total do frete, edição completa e seleção em lote com marcar todas',
                        details: [
                            'Coluna Frete em A Receber agora exibe a soma total das cargas no cabeçalho para leitura rápida do valor acumulado.',
                            'Fluxo de faturamento recebeu checkbox mestre acima da tabela para marcar/desmarcar todas as cargas de uma vez.',
                            'Cargas canceladas lançadas agora podem ser editadas (data, placa, aviário, frete, nº viagem e observação) tanto em A Receber quanto em Recebidas.',
                        ],
                    },
                    {
                        title: 'UX fina: status de entrevistas com fundo colorido e donut de Abono com melhor legibilidade',
                        details: [
                            'Status GUEP/RH na lista de entrevistas passaram a usar fundo colorido também nos selects editáveis para facilitar triagem visual por master e usuário.',
                            'Gráfico Abono x Sem Abono foi ampliado e teve área interna/fontes ajustadas para evitar sobreposição do texto e manter leitura limpa no centro do donut.',
                        ],
                    },
                ],
            },
        ],
    },
    {
        dateLabel: 'Quarta-Feira, 01/04/2026',
        sections: [
            {
                panel: 'Gestão de Fretes',
                items: [
                    {
                        title: 'Idioma PT/EN agora aplicado no site inteiro do Transporte (não só sidebar)',
                        details: [
                            'Implementado motor global de tradução no frontend para toda a área de Transporte, cobrindo conteúdo das páginas (cards, títulos, botões, tabelas e mensagens visíveis) além da navegação lateral.',
                            'Tradução passa a atuar em tempo real quando English é selecionado em Configurações, com observação de mudanças de tela para acompanhar navegação sem recarregar.',
                            'Adicionado cache local de traduções para reduzir chamadas repetidas e manter experiência fluida entre sessões.',
                            'Mudança foi aplicada sem alterar estrutura de banco, migrations ou registros já lançados.',
                        ],
                    },
                    {
                        title: 'Conta Demo protegida em modo somente leitura + idioma removido da sidebar',
                        details: [
                            'API autenticada agora aplica bloqueio de escrita para a conta Demo (POST/PUT/PATCH/DELETE), garantindo que acessos de apresentação não alterem informações já lançadas no banco.',
                            'Proteção opera por middleware sem migrations e sem mutação em dados existentes, preservando integralmente os registros operacionais atuais.',
                            'Seletor de idioma foi removido da sidebar (layout padrão, foco e mobile) para simplificar navegação e evitar ações duplicadas no menu lateral.',
                            'Alteração de idioma permanece disponível somente em Configurações, com persistência global entre sessões.',
                        ],
                    },
                    {
                        title: 'Login com atalho Demo no primeiro acesso + idioma PT/EN tambem em Configuracoes',
                        details: [
                            'Tela de login de Transporte passou a mostrar, no primeiro acesso do navegador, um botao `Demo` que auto preenche credenciais de demonstracao para acelerar entrada em ambiente de apresentacao.',
                            'A exibicao do botao Demo e controlada por flag local de primeiro acesso, evitando poluicao visual recorrente apos o usuario ja conhecer o fluxo.',
                            'Pagina de Configuracoes recebeu controle dedicado de idioma (Portugues/English), aplicado globalmente no painel administrativo.',
                            'Troca de idioma agora propaga evento global para atualizar interfaces montadas em tempo real sem depender de recarregamento completo da pagina.',
                        ],
                    },
                    {
                        title: 'Layout administrativo com seletor de idioma (PT/EN) e formatação dinâmica de números/datas',
                        details: [
                            'Admin Layout recebeu seletor persistente de idioma (Português/Inglês) no menu lateral padrão, no modo foco e no menu mobile.',
                            'Navegação compartilhada (títulos de painel, rótulos de links, diálogo de navegação rápida e atalhos exibidos) agora alterna entre PT/EN em tempo real.',
                            'Funções centrais de formatação do transporte passaram a respeitar o idioma selecionado para exibição de datas, números, percentuais e moeda.',
                            'Preferência de idioma é salva em `localStorage` e aplicada no atributo `lang` do documento para manter consistência de UX entre sessões.',
                        ],
                    },
                    {
                        title: 'Férias: gráfico Abono x Sem Abono com percentual + quantidade real e proteção contra inconsistência automática de 20/30 dias',
                        details: [
                            'Dashboard de Férias passou a retornar e exibir, no bloco de Abono x Sem Abono, não só o percentual, mas também a quantidade absoluta de férias `Com abono` e `Sem abono`, além do total considerado no filtro atual.',
                            'No donut e na legenda, a leitura agora mostra `% + quantidade`, reduzindo ambiguidade na comparação entre unidade específica e visão `Todas as unidades`.',
                            'Store/Update de férias foram reforçados para derivar `dias_ferias` e `com_abono` a partir do intervalo real entre `data_inicio` e `data_fim` quando a data final é informada, evitando registro inconsistente por combinação divergente no formulário.',
                            'Foi adicionada validação de integridade para bloquear intervalos que não resultem em 20 ou 30 dias, eliminando gravações que distorçam o indicador de abono no dashboard.',
                            'Testes de API de férias foram ampliados para cobrir totais do gráfico por unidade/todos e regressão de consistência entre datas, dias e abono.',
                        ],
                    },
                    {
                        title: 'GitHub em inglês para admissions: README técnico, roteiro de demo de 2 minutos e checklist de publicação final',
                        details: [
                            'README principal do projeto foi reescrito em inglês com narrativa de engenharia orientada a admissions dos EUA, cobrindo problema, arquitetura, módulos, confiabilidade, testes e deploy.',
                            'Foi incluído roteiro prático de demo de 2 minutos em inglês com timeline por blocos (problema, walkthrough, profundidade técnica, qualidade de entrega e impacto).',
                            'Foi adicionada checklist de publicação para GitHub/demo com critérios de apresentação, prova de qualidade, segurança operacional e sequência final de validação antes de compartilhar.',
                            'A documentação nova foi vinculada no README para facilitar leitura rápida por avaliadores técnicos e não técnicos.',
                        ],
                    },
                    {
                        title: 'Pacote de estabilização final: regressões corrigidas, permissões reforçadas e suíte 100% verde',
                        details: [
                            'Corrigidas regressões de segurança de acesso para o papel Usuário nas rotas sensíveis de Fretes e Férias, restaurando bloqueio padrão por permissão no backend.',
                            'Fluxo de lançamento em lote de Pagamentos foi ajustado para atualizar corretamente registros existentes por colaborador/tipo/data sem violar chave única.',
                            'Testes de Fretes e Férias foram alinhados às regras vigentes (KM fora de faixa apenas com alerta no front; payload de férias com campo tipo obrigatório).',
                            'Validação funcional concluída com sucesso: suíte de testes completa passou (128 testes), build de frontend ok, migrate sem pendências, optimize clear/rebuild ok e domínio público online.',
                        ],
                    },
                    {
                        title: 'Férias: Abono x Sem Abono agora respeita filtro de unidade + lista de Férias Gozadas sem corte visual incorreto',
                        details: [
                            'Dashboard de Férias foi corrigido para calcular percentuais de `Com abono` e `Sem abono` com base na unidade selecionada no filtro, eliminando leitura global quando a visão está segmentada por unidade.',
                            'Métricas derivadas de lançamentos do dashboard (incluindo programadas e lançamentos do ano) passaram a seguir o mesmo recorte de unidade para manter consistência entre cards e gráfico.',
                            'No bloco de relatórios por período, a lista de `Férias gozadas` deixou de limitar visualização em 5 itens, removendo divergência entre total exibido no card e quantidade renderizada abaixo.',
                            'Listas de `Admissões` e `Demissões` também foram ajustadas para exibir todos os registros no período com rolagem interna, sem truncamento silencioso.',
                            'Adicionado teste de regressão em API garantindo que o percentual de abono muda corretamente conforme o `unidade_id` informado no endpoint de dashboard de férias.',
                        ],
                    },
                    {
                        title: 'Pacote viabilidade/impacto >=7 implementado: idempotência crítica, limite adaptativo, observabilidade central, painel de filas, contratos e E2E no CI',
                        details: [
                            'Adicionado middleware de idempotência para operações críticas de escrita (Fretes, Spot, Lançamento em lote de Pagamentos e criação de Férias), com replay seguro por `Idempotency-Key`.',
                            'Rate limit evoluído para modelo adaptativo por perfil e risco da rota, reduzindo limite automaticamente em endpoints sensíveis e cenários de tentativa suspeita.',
                            'Nova central de observabilidade via API com métricas de latência por rota, agregados HTTP 2xx/4xx/5xx, exceções recentes e alertas automáticos por threshold.',
                            'Gestão de filas reforçada com endpoints administrativos para visão geral, listagem de failed jobs, retry individual/em massa e limpeza controlada.',
                            'Criados testes de contrato de API para dashboards principais e suíte E2E crítica autenticada cobrindo login e fluxos centrais de Fretes/Pagamentos/Férias.',
                            'Workflow de testes recebeu gates explícitos de Contrato e E2E antes da suíte completa, com limpeza de caches otimizados para evitar rotas/config desatualizadas no CI.',
                            'Validação final concluída com sucesso: contratos e E2E passando, suíte completa verde (134 testes), build ok, migrate sem pendências, optimize clear/rebuild ok e checks local/público online.',
                        ],
                    },
                ],
            },
        ],
    },
    {
        dateLabel: 'Quarta-Feira, 25/03/2026',
        sections: [
            {
                panel: 'Gestão de Fretes',
                items: [
                    {
                        title: 'Férias: eixo da timeline corrigido após coluna de nomes + gráfico de pizza azul/vermelho em Abono x Sem Abono',
                        details: [
                            'A régua de datas da timeline passou a iniciar exatamente após a divisória da coluna de nomes, eliminando rótulos sobrepostos na área de identificação dos colaboradores.',
                            'O topo do card `Abono x Sem Abono` foi atualizado para gráfico de pizza com duas cores de leitura direta (azul para com abono e vermelho para sem abono), mantendo a distribuição e legenda aprovadas.',
                        ],
                    },
                    {
                        title: 'Férias: timeline 100% responsiva sem scroll horizontal + marcação de 4 em 4 dias + edição por duplo clique',
                        details: [
                            'A timeline do Dashboard de Férias foi ajustada para ocupar sempre a largura máxima visível do painel, removendo necessidade de rolagem horizontal para leitura geral.',
                            'O eixo superior passou a exibir marcações espaçadas (a cada 4 dias) para reduzir poluição visual, mantendo posicionamento proporcional real dos blocos de férias no intervalo entre os marcos.',
                            'Lançamentos na timeline agora podem ser editados com duplo clique diretamente no retângulo da barra, abrindo modal de edição com tipo, dias, abono e datas.',
                        ],
                    },
                    {
                        title: 'Férias: timeline alinhada por dia, filtro sutil por unidade, taxa de liberadas e relatórios por período',
                        details: [
                            'Dashboard de Férias foi reestruturado com foco visual na timeline: cabeçalho de datas diário e barras agora compartilham a mesma escala horizontal em pixels por dia, eliminando desalinhamento entre eixo e períodos.',
                            'Filtro sutil de unidade foi aplicado no topo da dashboard para restringir timeline e bloco de vigentes por unidade específica (com opção Todas as unidades).',
                            'Card duplicado de `Férias a vencer` foi removido, mantendo a leitura por faixa operacional (`Faixa: À Vencer`).',
                            'Indicador `Taxa de vencidas` foi substituído por `Taxa de liberadas`, alinhando o KPI com foco de planejamento ativo.',
                            'Adicionado gráfico de pizza (donut) de `Com abono` versus `Sem abono` com percentual e legenda simples em duas cores.',
                            'Incluída seção de relatórios por período (data inicial/final) com consolidados e listas de `Férias gozadas`, `Admissões` e `Demissões`, alimentada por novo endpoint dedicado de reports.',
                        ],
                    },
                    {
                        title: 'Férias: observações persistidas no cadastro + campo de observação no Lançar Férias',
                        details: [
                            'Corrigida persistência de observações em lançamentos de férias (create/update), com retorno no histórico do colaborador dentro do Painel de Cadastro.',
                            'Adicionado campo de observações no painel `Lançar Férias` para registrar contexto do lançamento sem impactar a listagem operacional principal.',
                            'As observações ficam disponíveis no histórico de férias do perfil do colaborador (Cadastro), conforme fluxo de consulta individual.',
                        ],
                    },
                    {
                        title: 'Cadastro: ao editar admissão, períodos aquisitivos de férias agora são recalculados automaticamente',
                        details: [
                            'Ao atualizar a data de admissão no cadastro do colaborador, o sistema agora reprocessa automaticamente todos os períodos aquisitivos de férias já lançados para esse colaborador.',
                            'O recálculo mantém a âncora fixa anual na data de admissão (mesmo dia/mês em todos os ciclos), corrigindo sequência histórica sem intervenção manual.',
                            'Foi adicionada validação para bloquear datas de admissão inválidas antigas (ex.: ano 0024), aceitando apenas datas a partir de 01/01/1900.',
                        ],
                    },
                    {
                        title: 'Férias: período aquisitivo corrigido para âncora fixa na data de admissão + recálculo global do histórico',
                        details: [
                            'A lógica de período aquisitivo foi corrigida para respeitar a data de admissão como âncora fixa anual (mesmo dia/mês em todos os ciclos), sem deslocar por data de lançamento de férias.',
                            'O próximo período passou a iniciar no dia seguinte ao fim do período anterior, removendo o erro de sobreposição/deslocamento de um dia na base de cálculo.',
                            'Store, update e delete de férias agora recalculam automaticamente toda a sequência de períodos do colaborador para manter consistência permanente após qualquer ajuste.',
                            'Foi aplicada migration de recálculo retroativo em todos os lançamentos já existentes para corrigir `periodo_aquisitivo_inicio` e `periodo_aquisitivo_fim` no banco.',
                            'As regras de status (`a_vencer`, `liberada`, `atencao`, `urgente`, `vencida`) foram mantidas, mudando apenas a base correta do período aquisitivo.',
                        ],
                    },
                    {
                        title: 'Férias: regra automática por intervalo no perfil + histórico normalizado + editar/excluir em Realizadas',
                        details: [
                            'No perfil do colaborador, férias passadas agora aplicam regra automática por intervalo informado: 17–27 dias normaliza para 20 dias com abono; 28+ normaliza para 30 dias sem abono.',
                            'Ajustada persistência para salvar `dias_ferias` explicitamente e normalizar `data_fim` conforme a regra do perfil, evitando divergência entre datas digitadas e tipo final de férias.',
                            'Incluída migration de correção retroativa para lançamentos `passada` já existentes, alinhando histórico com a mesma regra aplicada aos novos lançamentos.',
                            'Painel Lançar Férias manteve controles manuais de `Dias` e `Abono`, agora enviados explicitamente ao backend para preservar operação administrativa.',
                            'Aba Realizadas da Lista de Férias recebeu ações de `Editar` e `Excluir`, com modal de edição e integração completa com API de atualização/remoção.',
                        ],
                    },
                    {
                        title: 'Cadastro: férias passadas em lote no perfil + permissões do tipo Usuário para operar cadastro completo',
                        details: [
                            'No perfil do colaborador, o modal de Nova Férias passou a permitir lançamento em lote de períodos passados: agora é possível adicionar vários pares de data início/fim com botão de adicionar (+) e gravar tudo de uma vez.',
                            'Cada período em lote é enviado automaticamente como tipo passada, mantendo compatibilidade com o Controle de Férias e acelerando carga histórica de dados no arranque do sistema.',
                            'Ajustadas permissões padrão do papel Usuário para acessar e operar o Painel de Cadastro completo (colaboradores, funções, tipos de pagamento, placas e aviários), mantendo bloqueio da área de Usuários.',
                            'Controllers de Cadastro e de Férias foram migrados de bloqueio fixo por role para validação por chave de permissão, permitindo granularidade real por ação sem abrir acesso indevido a gestão de usuários.',
                            'Regras de entrevistas seguem com comportamento de autoria: usuário sem permissão de visibilidade global continua sem acesso/edição de entrevistas de outros autores.',
                        ],
                    },
                    {
                        title: 'Férias: tipo Passada automático no perfil do colaborador + timeline com apenas datas dentro das barras',
                        details: [
                            'Cadastro de férias no perfil do colaborador foi ajustado para enviar `tipo=passada` automaticamente (sem exibir campo de tipo nessa tela).',
                            'Validação de férias no backend passou a aceitar o novo tipo `passada`, mantendo `confirmado` e `previsao` no painel principal.',
                            'Timeline visual de férias foi simplificada: dentro de cada retângulo agora aparece somente o intervalo de datas (início → fim), sem textos de status/tipo.',
                            'Lançamento principal de férias recebeu nova opção `Passada` para uso manual quando necessário.',
                        ],
                    },
                    {
                        title: 'Férias: timeline visual em gráfico com eixo de dias e barras por colaborador (estilo Gantt)',
                        details: [
                            'A seção de linha do tempo do Dashboard de Férias deixou de ser lista textual e passou a ser um gráfico horizontal com eixo de datas e barras por colaborador.',
                            'Cada barra agora representa claramente início e fim das férias, com leitura visual imediata de duração e sobreposição entre vigentes e agendadas.',
                            'Foi adicionada marcação de data atual no gráfico para facilitar comparação operacional entre quem já iniciou, quem está em curso e quem ainda vai iniciar.',
                        ],
                    },
                    {
                        title: 'Férias: vigentes no dashboard, tipo confirmado/previsão no lançamento e timeline de vigentes/agendadas',
                        details: [
                            'Dashboard de Férias passou a exibir uma lista dedicada de férias vigentes com colaborador, período e dias restantes até o término.',
                            'Lançamento de Férias recebeu novo campo obrigatório `Tipo` com opções `Confirmado` e `Previsão`, persistido no backend para diferenciar programação de confirmação.',
                            'Lista de Férias (aba Realizadas) passou a mostrar a coluna `Tipo` para rastrear rapidamente quais lançamentos são previsão e quais estão confirmados.',
                            'Dashboard de Férias ganhou bloco de linha do tempo com vigentes e agendadas, exibindo status operacional e intervalo de cada colaborador.',
                            'Backend de Férias foi ampliado para retornar `ferias_vigentes` e `timeline` no endpoint de dashboard, mantendo os KPIs existentes no mesmo payload.',
                        ],
                    },
                    {
                        title: 'Prioridades máximas/segundas aplicadas: exportação assíncrona, telemetria, compressão, timeout/retry e filtros rápidos 7/30/90',
                        details: [
                            'Implementada infraestrutura de exportação XLSX assíncrona com fila (`async_exports`), jobs dedicados de Fretes/Pagamentos e rotas de status/download para desacoplar geração pesada da resposta HTTP síncrona.',
                            'Adicionados middleware global de telemetria de API (coleta de latência com métricas p50/p95) e endpoint dedicado de observabilidade para acompanhamento de desempenho em produção.',
                            'Adicionado middleware de compressão de respostas JSON (gzip) com ativação condicional por payload/accept-encoding para reduzir tráfego e tempo de transferência.',
                            'Cliente HTTP do frontend recebeu timeout por requisição e política de retry/backoff com jitter para chamadas idempotentes, aumentando resiliência contra falhas transitórias.',
                            'Dashboard de Pagamentos passou a consumir endpoint agregado (`/payroll/dashboard-page`) para reduzir múltiplas chamadas em cascata no carregamento inicial.',
                            'Relatórios de Pagamentos por Unidade e por Colaborador receberam atalhos de período `7 dias`, `30 dias` e `90 dias` para acelerar filtros operacionais.',
                            'Dashboard de Fretes passou a calcular KPIs e alertas críticos com uma única consulta agregada no banco, reduzindo múltiplas leituras repetidas no mesmo recorte.',
                            'Filtros rápidos `7 dias`, `30 dias` e `90 dias` foram expandidos também para Dashboard de Fretes, Lista de Entrevistas e Log de Ações.',
                            'Consulta de pagamentos recentes no dashboard foi ajustada para buscar apenas colunas necessárias e relações mínimas, reduzindo payload e custo de serialização.',
                            'Dashboard de Pagamentos foi simplificado removendo os cards de `Pagamentos lançados`, `Cobertura da folha` e `Pagamentos a fazer`, mantendo foco em total do mês, ticket médio e distribuição real.',
                            'Foi adicionada visualização em gráfico de pizza (donut) com legenda interativa por tipo de pagamento; ao passar o mouse na cor/fatia, o painel exibe o percentual correspondente.',
                            'Gráfico de pizza do Dashboard de Pagamentos foi reposicionado para o topo da tela para leitura imediata ao abrir o painel, com destaque visual acima dos demais blocos.',
                            'Paleta do gráfico foi ampliada e redefinida com cores distintas por categoria para melhorar separação visual dos tipos de pagamento.',
                            'Dashboard de Pagamentos passou a aceitar seleção de competência por mês/ano no topo e recarrega o gráfico/indicadores conforme o período escolhido.',
                            'Legenda do gráfico de pizza passou a exibir o percentual de cada tipo de pagamento de forma fixa (sem depender de hover), mantendo destaque no centro do gráfico quando o mouse passa sobre a fatia.',
                            'Card de `Ticket médio por lançamento` foi substituído por `Valor médio por colaborador pago`, calculado como total do mês dividido pela quantidade de colaboradores com pagamento lançado.',
                            'Exclusão de pagamentos foi ajustada para operação administrativa sem bloqueio por autor do registro, corrigindo falha de remoção no painel de lista.',
                            'Home do sistema deixou de exibir métricas derivadas de `Pagamentos lançados`, `Cobertura` e `Pendências`, preservando somente o total financeiro mensal do módulo.',
                            'Lista de Fretes recebeu switch de navegação no topo para alternar rapidamente entre `Integração` e `Spot`, seguindo o padrão visual de alternância já usado no Log.',
                            'Cadastro de Colaboradores foi temporariamente padronizado para sexo `M` em toda a plataforma, com migração aplicada para atualizar registros existentes e persistência forçada no backend.',
                        ],
                    },
                    {
                        title: 'Pacote performance/QoL: paginação incremental, endpoint agregado, cache curto com invalidação e skeleton padronizado',
                        details: [
                            'Dashboard de Fretes passou a consumir endpoint agregado único (`/freight/dashboard-page`), reduzindo chamadas paralelas e melhorando latência percebida no carregamento inicial.',
                            'Lista de Fretes saiu do padrão `per_page=500` para paginação incremental (`Carregar mais`) e virtualização de linhas no frontend, reduzindo custo de render em listas extensas.',
                            'Dashboards pesados de Fretes e Pagamentos receberam cache curto (~60s) no backend, com versionamento e invalidação automática em operações de criação/edição/exclusão/importação.',
                            'Filtros textuais estratégicos tiveram debounce ampliado para `450ms` (Log, Cargas Canceladas, Next Steps e Onboarding), reduzindo churn de reprocessamento e requisições sob digitação contínua.',
                            'Relatórios longos de Pagamentos (por Unidade e por Colaborador) receberam skeleton loading padronizado para melhorar UX durante espera de consultas analíticas.',
                            'Criada migration de índices de performance para `freight_entries` e `pagamentos`, priorizando colunas de maior uso em filtros por competência, data, autor e colaborador.',
                        ],
                    },
                    {
                        title: 'Bob em modo hibernado: desativado por flag sem exclusão do recurso',
                        details: [
                            'Bob foi mantido no código, porém desligado por configuração para não renderizar no frontend e não interferir no uso diário da plataforma.',
                            'As rotas da API do Bob passaram a ser registradas apenas quando a flag de backend estiver ativa, removendo caminho de execução quando desabilitado.',
                            'No layout administrativo, o chat do Bob passou para carregamento lazy e condicionado por flag de frontend, evitando custo de runtime e chamadas enquanto estiver desligado.',
                            'Foram adicionadas variáveis dedicadas de ambiente (`BOB_ENABLED` e `VITE_BOB_ENABLED`) com padrão `false`, permitindo reativação futura sem refatoração.',
                        ],
                    },
                    {
                        title: 'Bob 100% interno: remoção do OpenAI e otimização de consultas para alta performance',
                        details: [
                            'Integração com OpenAI foi removida do backend, frontend, rotas e arquivos de ambiente para manter o Bob totalmente interno e sem dependência de chave paga.',
                            'Motor do Bob foi consolidado em intenções operacionais internas para consultar e lançar dados em fretes, pagamentos, férias, entrevistas e colaboradores.',
                            'Extração de colaborador/unidade foi otimizada para reduzir varredura completa em memória e priorizar busca filtrada no banco, melhorando tempo de resposta sob carga.',
                            'Fluxo de resposta e histórico foi mantido com persistência por usuário, garantindo continuidade de contexto sem degradar a experiência do painel.',
                        ],
                    },
                    {
                        title: 'Transparência da IA no Bob: status OpenAI visível e fallback honesto',
                        details: [
                            'Foi adicionado endpoint de status do Bob para informar no frontend se a IA externa está ativa, qual provedor está em uso e o modelo configurado.',
                            'Cabeçalho do chat agora exibe indicador de `IA OpenAI ativa` ou `IA externa inativa`, eliminando a sensação de que o bot está usando IA quando não está.',
                            'Mensagem de fallback foi ajustada para informar claramente quando falta `OPENAI_API_KEY`, em vez de parecer resposta genérica programada.',
                            'Arquivos de ambiente local e produção receberam variáveis de configuração do OpenAI (`OPENAI_API_KEY` e `OPENAI_MODEL`) para facilitar ativação real.',
                        ],
                    },
                    {
                        title: 'Bob híbrido com IA ampla + ocultação na tela de Nova Entrevista',
                        details: [
                            'Bob passou a ter rota híbrida com IA generativa (OpenAI) para respostas livres e conversacionais quando a solicitação não cair nas intenções operacionais estruturadas.',
                            'Mensagens de fallback foram suavizadas para evitar resposta engessada de “não fui programado”, mantendo condução ativa com orientação prática ao usuário.',
                            'Nova configuração de serviços foi adicionada para chave/modelo OpenAI e o Bob agora usa histórico recente do próprio usuário como contexto de conversa.',
                            'Botão/chat do Bob foi removido especificamente da página Nova Entrevista para não interferir no preenchimento desse fluxo.',
                        ],
                    },
                    {
                        title: 'Bob ampliado para sistema completo + correções de sobreposição e botão arredondado',
                        details: [
                            'Bob deixou de atuar somente em fretes e passou a responder também sobre pagamentos, férias e entrevistas, incluindo visão geral consolidada do sistema.',
                            'Foram adicionadas novas intenções no backend para resumo de pagamentos por competência, resumo de entrevistas e consulta de vencimento de férias por colaborador.',
                            'Layout administrativo recebeu área de segurança no rodapé para impedir que o botão/chat do Bob sobreponha campos finais de formulários como observações em Nova Entrevista.',
                            'Botão de abertura do Bob foi refinado com arredondamento completo nos quatro cantos e posicionamento estável no canto inferior direito com afastamento visual adequado.',
                        ],
                    },
                    {
                        title: 'Hotfix visual do Bob: posição fixa no canto e tamanho estável sem deslocamento',
                        details: [
                            'Corrigido comportamento de abertura em que o Bob podia iniciar fora do ponto final e deslocar para a direita com redução de tamanho durante renderização.',
                            'Painel voltou ao tamanho grande fixo com ancoragem absoluta acima do botão, removendo efeito de movimento/encolhimento percebido na carga da página.',
                            'Botão preto `Bob` foi mantido encostado no canto inferior direito de forma estável, sem ser empurrado pelo container do painel fechado.',
                        ],
                    },
                    {
                        title: 'Bob evoluído para operação contínua: histórico persistente, painel redimensionável e botão no canto exato',
                        details: [
                            'Histórico de conversa do Bob passou a ser persistido por usuário no backend, com carregamento automático ao abrir o sistema e manutenção do contexto entre sessões.',
                            'Foram adicionados endpoints dedicados para consultar e limpar histórico do Bob com o mesmo controle de acesso administrativo já aplicado no chat.',
                            'Painel do Bob agora é redimensionável e salva o tamanho preferido localmente, mantendo experiência estável para diferentes monitores e rotinas operacionais.',
                            'Botão de abertura foi ancorado encostado no canto inferior direito e removidos elementos visuais de brilho para uma aparência mais limpa e corporativa.',
                        ],
                    },
                    {
                        title: 'Bob versão premium: visual corporativo e UX profissional de chat',
                        details: [
                            'Componente do Bob recebeu redesign completo para padrão enterprise com painel flutuante moderno, bordas refinadas e hierarquia visual mais limpa.',
                            'Foram adicionados status online, contador de não lidas, horário por mensagem, botão de limpar conversa e transições suaves de abertura/fechamento.',
                            'Composer e atalhos rápidos foram refinados para uso contínuo em operação, mantendo chat no canto da tela sem bloquear o trabalho no restante do sistema.',
                        ],
                    },
                    {
                        title: 'Refino visual do Bob: chat flutuante no canto sem bloquear a operação',
                        details: [
                            'Bob deixou de abrir em modal central e passou para chat flutuante fixo no canto inferior direito, mantendo a tela livre para continuar trabalhando.',
                            'Layout do chat foi redesenhado com cabeçalho compacto, bolhas de conversa, rolagem automática, sugestões rápidas em linha e composer enxuto.',
                            'Botão do Bob também foi refinado para visual mais moderno e consistente com o painel, com abertura/fechamento direto no próprio canto.',
                        ],
                    },
                    {
                        title: 'Bob (chatbot interno) implantado para consulta e lançamento operacional de fretes',
                        details: [
                            'Foi criado o Bob no painel com botão flutuante dedicado no canto inferior direito para abrir chat operacional dentro do sistema.',
                            'Bob agora consegue consultar lançamentos de frete por dia, entregar resumo analítico mensal e filtrar por unidade quando informado no texto.',
                            'Bob também consegue lançar frete por comando textual com validações de segurança para campos críticos (data, unidade, frete, cargas e km).',
                            'Os botões antigos de `Navegação rápida` e `Modo foco` foram removidos do canto inferior direito e substituídos pelo acesso único ao Bob.',
                            'Nova API dedicada (`POST /api/bob/chat`) foi adicionada com controle de acesso administrativo e parser de intenções para operação em linguagem natural.',
                        ],
                    },
                ],
            },
        ],
    },
    {
        dateLabel: 'Terça-Feira, 24/03/2026',
        sections: [
            {
                panel: 'Gestão de Fretes',
                items: [
                    {
                        title: 'Hotfix: exclusão da Lista de Fretes voltou a remover de forma definitiva',
                        details: [
                            'Corrigido bug de model binding implícito no backend: a rota usa `{entry}` e o controller estava recebendo parâmetro com nome divergente em `update/destroy`, causando operação de exclusão sem efeito real.',
                            'Assinaturas dos métodos de atualização e exclusão em Fretes foram alinhadas ao parâmetro da rota para garantir resolução correta do registro.',
                            'Incluído teste de regressão para validar que o endpoint `DELETE /api/freight/entries/{id}` realmente remove o lançamento do banco (não apenas retorno 204).',
                            'Validações finais executadas: build frontend, migrate, optimize:clear/optimize e check online/local com status 200.',
                        ],
                    },
                    {
                        title: 'Central Analítica reforçada com visão operacional/mensal consolidada e base API confiável',
                        details: [
                            'Dia da semana dos lançamentos de frete passou a ser calculado no backend e entregue pela API (`dia_semana`), removendo inconsistência de timezone no frontend.',
                            'Dashboard de Fretes recebeu filtro por unidade integrado à API e também à tabela diária, mantendo totais e listagem alinhados ao mesmo recorte.',
                            'Aba Operacional da Central Analítica foi redesenhada para modelo consolidado com bloco de Abatedouro e bloco Kaique com alternância por botões (`Integração` e `Spot`), sem alteração da aba Tendência.',
                            'Aba Análise Mensal passou a exibir indicadores consolidados de Abatedouro e Kaique (Integração/Spot) com percentuais de realizado vs programado nos KPIs principais.',
                            'Header duplicado no topo das páginas foi removido do layout administrativo para eliminar repetição visual de título em todas as telas.',
                            'FreightController foi refatorado para entregar payloads operacionais/mensais mais completos por unidade, com métricas derivadas e percentuais padronizados.',
                        ],
                    },
                ],
            },
        ],
    },
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
                    {
                        title: 'Padronização transversal de telas + hardening de API + cache de performance',
                        details: [
                            'Admin Layout recebeu barra de comando padrão em todas as páginas com atalhos operacionais visíveis e botão de Navegação rápida, reduzindo inconsistência de UX entre módulos.',
                            'Foi incluído Modo foco global para telas operacionais, ocultando a navegação lateral no desktop durante execução de tarefas longas de lançamento/edição.',
                            'Segurança de API foi reforçada com monitor de tentativas inválidas (401/403/419), com bloqueio temporário progressivo por IP em cenários de abuso e registro de auditoria no log.',
                            'Home passou a usar cache curto por fingerprint de permissões/período e o catálogo de permissões por cargo passou a ser servido por cache com invalidação automática no update, reduzindo consultas repetidas.',
                            'Atualização de permissões agora incrementa versão de cache para forçar refresh rápido dos painéis da Home após mudanças de acesso.',
                        ],
                    },
                    {
                        title: 'Correção global de toast persistente + limpeza de dados de simulação',
                        details: [
                            'Componente compartilhado de notificação recebeu auto-fechamento padrão (5s) e botão de fechar, evitando mensagens presas em qualquer tela que use o mesmo toast.',
                            'Foi removida a unidade de simulação criada para testes e também os registros órfãos associados, eliminando lixo operacional visível no cadastro.',
                            'Ajuste foi aplicado de forma centralizada no componente, cobrindo páginas de Cadastro, Fretes, Folha, Férias, Entrevistas e Onboarding sem precisar alterar cada fluxo manualmente.',
                        ],
                    },
                ],
            },
            {
                panel: 'Gestão de Fretes',
                items: [
                    {
                        title: 'Fretes e Pagamentos: filtros por período, exclusão robusta, dia da semana e Excel por lançamento',
                        details: [
                            'Dashboard de Fretes passou a aceitar intervalo manual (`data inicial` + `data final`) e, quando as duas datas são informadas, o recorte por período sobrepõe a competência mês/ano automaticamente.',
                            'Foi adicionado botão de limpar período no Dashboard de Fretes para retornar ao comportamento padrão por competência mensal.',
                            'Na Lista de Fretes e na tabela diária do Dashboard de Fretes, entrou a coluna de dia da semana ao lado da data para leitura operacional mais rápida.',
                            'Exclusão da Lista de Fretes foi endurecida com recarga anti-stale após delete (revalidação curta com cache-busting) para reduzir reaparecimento visual de lançamento removido.',
                            'Barra superior global foi compactada para recuperar espaço vertical e os atalhos de `Modo foco`/`Navegação rápida` foram movidos para um controle flutuante fora do fluxo do conteúdo.',
                            'Em Pagamentos, o botão de Excel mensal por filtro foi removido e substituído por exportação por lançamento (somente quando houver tipos VT/VR/Cesta Básica).',
                            'Os gráficos de variação mensal dos relatórios de Pagamentos (por colaborador e por unidade) passaram a mostrar tooltip no hover de cada ponto, no mesmo padrão de interação da tendência da Central Analítica.',
                        ],
                    },
                    {
                        title: 'Refatoração visual corporativa dos dashboards e tabelas com cores semânticas controladas',
                        details: [
                            'Dashboards de Férias, Pagamentos, Fretes e Entrevistas foram retomados para base preta/neutra, mantendo cores somente para status e sinalização crítica.',
                            'Foi aplicado padrão de hierarquia visual em 3 níveis (destaque, médio e detalhe) com classes compartilhadas de card KPI, título, valor principal e texto de apoio.',
                            'Cards passaram a incluir ícones e fundos leves por contexto (`bg-soft`) sem poluição de layout, preservando visual clean e corporativo.',
                            'Tabelas no escopo do layout administrativo receberam zebra striping, hover consistente e alinhamento vertical uniforme para leitura mais rápida.',
                            'Status críticos foram convertidos para badges semânticas no padrão fixo (`vermelho = problema`, `amarelo = atenção`, `verde = positivo`, `azul = informativo`) em módulos de Férias, Entrevistas e Cadastro.',
                        ],
                    },
                    {
                        title: 'Permissões por função integradas à Home + correção de inteiro no Lançar Fretes',
                        details: [
                            'A Home passou a renderizar painéis de acordo com permissões realmente configuradas por função, eliminando cenário de precisar entrar por URL para acessar módulo autorizado.',
                            'Tela de Permissões por função recebeu botão direto "Ver painéis na Home" para validar visualmente a configuração após salvar.',
                            'No Lançar Fretes, campos de aves/viagens/veículos passaram a ser normalizados para inteiro no envio, evitando erro de validação `integer` em entradas com separador de milhar no padrão brasileiro.',
                            'Cálculo de métricas da Home foi otimizado para rodar apenas para módulos permitidos ao perfil, reduzindo consultas desnecessárias.',
                        ],
                    },
                    {
                        title: 'Pacote transversal final: segurança de rotas, observabilidade global e limpeza automatizada',
                        details: [
                            'Rotas sensíveis de Entrevistas, Próximos Passos e Onboarding receberam throttle explícito para padronizar proteção contra rajadas e abuso em endpoints de alteração/geração de documentos.',
                            'Cliente de API passou a ter timeout padronizado, deduplicação de GET em voo e eventos globais de erro (`transport:api-error`), permitindo feedback consistente sem tratamento manual em cada página.',
                            'Layout administrativo foi conectado ao evento global de erro da API para exibir aviso unificado em toast, reduzindo lacunas de feedback em fluxos com falha de rede/servidor.',
                            'Foi criado comando operacional `php artisan transport:cleanup-simulation` com `--dry-run` para limpeza repetível e segura de unidades/colaboradores de simulação e registros órfãos.',
                            'Componente de notificação recebeu refinamento de acessibilidade no botão de fechar com foco visível via teclado, mantendo padrão UX sem regressão visual.',
                        ],
                    },
                    {
                        title: 'Ajustes operacionais finais: limpeza de simulação, aves em milhar, adiantamento salarial e cards de pendências com explicação',
                        details: [
                            'Registros de simulação remanescentes foram removidos do banco (funções, tipos de pagamento e cadastros auxiliares com nome de teste), eliminando itens indevidos na operação diária.',
                            'Lançar Fretes passou a interpretar corretamente entradas com separador de milhar em campos inteiros (ex.: `242.666`), evitando truncamento para `242` na lista de fretes.',
                            'Perfil de colaborador ganhou campo `Adiantamento Salarial (S/N)` com persistência no cadastro e edição rápida no perfil, permitindo controle direto por pessoa.',
                            'No Lançar Pagamentos, ao selecionar tipo de pagamento com `adiantamento`, colaboradores com flag `S` são marcados automaticamente, mantendo liberdade para remover/adicionar manualmente.',
                            'Tela de Pendências recebeu descrição curta em cada card para explicar objetivamente o significado de cada indicador, no mesmo padrão de ajuda contextual da Home.',
                        ],
                    },
                    {
                        title: 'Refino visual e de navegação: títulos de pendências em destaque + sidebar inteligente no modo foco',
                        details: [
                            'Os títulos dos cards em Pendências foram promovidos para hierarquia visual principal (preto, negrito e maior) para separar claramente título e descrição.',
                            'Modo foco ganhou navegação lateral por hover: ao encostar o mouse na borda esquerda no desktop, a sidebar aparece; ao tirar o mouse, ela recolhe automaticamente.',
                            'Quando a sidebar do modo foco aparece, o conteúdo principal agora também desloca para a direita com transição suave e retorna ao fechar, eliminando sobreposição de área útil da página.',
                            'Ajuste preserva o ganho de área útil do foco sem perder acesso rápido ao menu, reduzindo cliques de troca entre módulos durante operação contínua.',
                            'Tela de Pendências também recebeu pequeno refino de renderização com composição memoizada dos cards, diminuindo trabalho repetido de montagem da grade.',
                        ],
                    },
                    {
                        title: 'Varredura ampla em todas as telas: padronização visual e cobertura total web/mobile',
                        details: [
                            'Foi executada varredura técnica completa em todo o workspace (frontend web, backend Laravel e app mobile), incluindo lint, types, build, testes e checks operacionais.',
                            'No módulo de Fretes, a tela Lista foi alinhada ao padrão global de tipografia de título (hierarquia consistente com as demais páginas administrativas).',
                            'Dashboard de Fretes e Log tiveram ajuste de espaçamento vertical e escala de título para manter o mesmo padrão visual adotado no Admin Layout.',
                            'Overlays customizados de Fretes (autocomplete/tooltip) tiveram z-index elevado para evitar conflitos de sobreposição em cenários de componentes flutuantes.',
                            'App mobile de motoristas passou a ter scripts de qualidade (`lint` e `typecheck`) no package para permitir varredura automática contínua dentro da rotina de validação.',
                        ],
                    },
                    {
                        title: 'Ajustes finais de operação diária: adiantamento em lote, exportação XLSX e correções de lista de pagamentos',
                        details: [
                            'Foi aplicada marcação em lote de `Adiantamento Salarial = S` para os motoristas enviados nas listas (fotos), com comparação normalizada de nomes para evitar falha por acentuação.',
                            'Listas de Fretes e Pagamentos ganharam botão de exportação em XLSX direto na tela, respeitando filtros ativos.',
                            'Lista de Pagamentos foi corrigida para carregar todos os registros filtrados em visão única antes do agrupamento, eliminando paginação inconsistente (várias páginas para poucos lançamentos agrupados).',
                            'Ações em Pagamentos foram compactadas para ícones (visualizar/editar/imprimir/excluir), reduzindo ruído visual na coluna de ações.',
                            'Lançar Pagamentos passou a ter ordenação por nome com alternância crescente/decrescente no cabeçalho da coluna Nome.',
                            'Cadastro de Colaboradores passou a abrir com filtro padrão em Ativos e migra automaticamente preferência antiga `Todos` para `Ativos` ao carregar.',
                            'No Lançar Pagamentos, tipos salariais (Adiantamento, Décimo Terceiro e Salário Mensal) agora têm bloqueio cruzado com tipos de benefícios/extras, evitando combinações indevidas no mesmo lançamento.',
                            'Ao selecionar Cesta Básica, a grade exibe campo global no topo da coluna para aplicar valor fixo automaticamente em todos os colaboradores marcados.',
                            'Tela de Descontos recebeu prioridades múltiplas (prioridade 1, 2 e 3) com aplicação sequencial por tipo; quando uma prioridade não cobre a parcela do mês, o saldo segue para a próxima prioridade configurada e, se houver apenas uma, acumula para os meses seguintes.',
                            'Na Lista de Pagamentos, apenas o botão de imprimir permanece verde; ações de visualizar/editar voltaram para estilo preto para reduzir poluição visual.',
                            'Foi corrigido bug no Lançar Pagamentos que carregava valores pré-preenchidos e travados sem ação do usuário em alguns tipos (ex.: Cesta Básica e Diária Extra).',
                            'A carga de colaboradores voltou a iniciar sem auto-preenchimento indevido e os inputs permanecem editáveis para quem está marcado no lançamento.',
                            'O campo global no topo agora aparece corretamente quando Cesta Básica está selecionada, mesmo sem Vale Refeição/Transporte ativos.',
                        ],
                    },
                    {
                        title: 'Correções de fechamento no Lançar/Imprimir Pagamentos para operação de benefícios e extras',
                        details: [
                            'No Lançar Pagamentos, ao selecionar tipo de Adiantamento, o auto-check voltou a marcar corretamente todos os colaboradores com `Adiantamento Salarial = S` mesmo quando a lista é carregada após a seleção do tipo.',
                            'A impressão dos lançamentos de benefícios/extras (tipos da coluna 2 e 3) foi convertida para formato planilha em paisagem com colunas fixas: `NOME`, `DIAS ÚTEIS`, `VR`, `PRÊMIO`, `VT`, `EXTRAS`, `CB`, `DESCONTOS`, `TOTAL CARTÕES` e `A PAGAR DINHEIRO`.',
                            'A composição dos totais segue a regra operacional solicitada: `TOTAL CARTÕES = VR + PRÊMIO + CB` e `A PAGAR DINHEIRO = VT + EXTRAS - DESCONTOS`.',
                            'O layout de impressão dos tipos da coluna 2/3 foi compactado (fonte menor e linhas mais baixas) para caber mais colaboradores por página sem alterar a impressão dos tipos salariais da coluna 1.',
                            'Dias úteis informado no lançamento agora é enviado no payload do lote, salvo no `observacao` de cada pagamento e reaproveitado no fluxo de edição do lançamento completo.',
                            'Com isso, o campo `DIAS ÚTEIS` passa a aparecer na impressão quando o lançamento foi salvo com essa informação, sem depender de recalcular VR/VT depois.',
                        ],
                    },
                    {
                        title: 'Exportação Excel de Pagamentos convertida para resumo mensal de VR/VA por colaborador',
                        details: [
                            'O botão de Excel nos filtros da Lista de Pagamentos agora usa apenas `mês` e `ano` selecionados para montar a planilha mensal consolidada.',
                            'A planilha passou a ter três colunas fixas (`Nome`, `VR`, `VA`), somando todos os lançamentos do mês por colaborador.',
                            'No cálculo: `VR` considera somente tipos de Vale Refeição e `VA` considera `Prêmio Média + Cesta Básica` (CB).',
                            'No rodapé da planilha são exibidos os totais gerais de VR e VA e, no topo, título de competência no formato `Mês/AA` (ex.: `Março/26`).',
                            'Corrigido cenário em que VR/VA saíam zerados no Excel mesmo com lançamentos no mês: a classificação agora usa normalização robusta de nomes (com/sem acento) e fallback por `tipo_pagamento_id` quando necessário.',
                        ],
                    },
                    {
                        title: 'Refino operacional transversal: férias por faixas, cores globais, ajustes de colaborador e robustez de frete',
                        details: [
                            'No painel/lista de Férias, o status passou a seguir a nova régua por dias corridos desde a base (admissão ou fim do último período aquisitivo): `1-365 À Vencer`, `366-576 Liberada`, `577-636 Atenção`, `637-699 Urgente`, `>=700 Vencida`.',
                            'A UI global recebeu reforço de legibilidade sem abandonar o estilo clean: tokens de tema foram ajustados para contraste mais útil em operação, com cabeçalhos de tabela mais destacados e hover de linhas com sinal visual mais claro.',
                            'Nos ajustes de Folha (descontos/empréstimos), seleção de colaborador agora fica em ordem alfabética e com busca parcial por nome (ex.: digitar `Ada` já filtra opções correspondentes).',
                            'Limites de KM no lançamento de frete foram atualizados para operação diária com validação de faixa (`mínimo 1000` quando informado e `máximo 25000`) e alerta de dashboard alinhado ao novo teto.',
                            'Fluxo de exclusão na Lista de Fretes foi reforçado para evitar sensação de item “não excluído”: remoção agora limpa cargas canceladas vinculadas em transação e recarrega a listagem após deletar.',
                            'Após validação visual em operação, o tema da sidebar/home e botões principais foi revertido para o padrão preto original (sem acentuação azul), mantendo apenas melhorias funcionais e de legibilidade que não alteram a identidade atual.',
                        ],
                    },
                    {
                        title: 'Home e dashboards enriquecidos com KPIs mais úteis para operação diária',
                        details: [
                            'Na Home, o card de Pagamentos foi corrigido para exibir `Pagamentos no mês atual` como quantidade (não moeda) e ganhou métricas adicionais de pendência/cobertura para leitura rápida de fechamento.',
                            'Cards da Home de Férias e Fretes receberam indicadores extras para contexto de decisão (ex.: taxa de vencidas e participação de terceiros), mantendo layout limpo.',
                            'No card de Férias da Home, `Férias vencidas` passou a ter destaque em vermelho quando houver volume, priorizando ação imediata.',
                            'Dashboard de Férias foi ampliado com contadores por faixa operacional (`À Vencer`, `Liberada`, `Atenção`, `Urgente`, `Vencida`) e destaque visual forte para vencidas/taxa de vencidas.',
                            'Dashboard de Fretes ganhou KPI explícito de lançamentos no período e o dashboard de Pagamentos teve revisão de cartões para separar melhor volume lançado, pendências e cobertura.',
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
                    {
                        title: 'Pagamentos e Férias: ajustes de gráfico, totais e gravação em lote',
                        details: [
                            'Dashboard de Pagamentos corrigido para renderizar donut corretamente quando existe somente 1 tipo no mês (fatia de 100%).',
                            'Tela de Lançar Pagamentos recebeu totalizador em negrito no rodapé de cada coluna de tipo de pagamento.',
                            'API de lançamento em lote de pagamentos ajustada para gravação por upsert na chave única (colaborador + tipo + data), evitando erro de duplicidade ao editar/reprocessar pagamento solo.',
                            'Dashboard de Férias teve o gráfico de Abono x Sem Abono refinado para estilo donut mais próximo do visual de Pagamentos, sem alterar largura/tamanho do card.',
                        ],
                    },
                    {
                        title: 'Confirmações de exclusão padronizadas com modal do sistema',
                        details: [
                            'Removida confirmação nativa do navegador na Lista de Férias e substituída por Dialog visual padrão do sistema, com layout consistente e botões claros de cancelar/confirmar.',
                            'Padronização aplicada após varredura global: não restaram usos de window.confirm/confirm no front-end do projeto.',
                            'Fluxo mantém o mesmo funcionamento para o usuário (continua exigindo confirmação antes de excluir), apenas com experiência visual moderna e consistente.',
                        ],
                    },
                    {
                        title: 'Correção de faixa no Lançar Fretes (KM) e ajuste automático de tipo em Férias',
                        details: [
                            'Alerta de faixa no Lançar Fretes foi corrigido para atuar no KM (1.000 a 15.000), e não no valor de frete.',
                            'Validação bloqueante de faixa de KM no backend foi removida para não impedir gravação; permanece apenas aviso de confirmação no front.',
                            'Lançamentos de férias com data fim já encerrada agora têm tipo atualizado automaticamente para "passada" nas consultas das telas de Férias.',
                        ],
                    },
                    {
                        title: 'Hardening geral: segurança, performance e robustez de erro',
                        details: [
                            'Dashboard de Fretes reforçado com divisão segura em SQL (NULLIF) para evitar edge cases em cálculos com carga zero.',
                            'Fluxo de lançamento em lote de Pagamentos otimizado para consulta indexada da data de pagamento e remoção de processamento redundante no backend.',
                            'Sincronização automática de férias encerradas para tipo "passada" recebeu throttle por cache para reduzir custo de atualização em chamadas frequentes.',
                            'Setup de 2FA no front foi endurecido: renderização do QR passou para data URL em imagem, removendo uso de dangerouslySetInnerHTML.',
                            'Tratamento de erros nas telas de Fretes, Férias e Pagamentos reforçado com mensagens fallback, evitando retorno indefinido ao usuário final.',
                            'Hospedagem pública no domínio fixo reiniciada com sucesso (app.kaiquetransportes.com.br).',
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
    const debouncedSearch = useDebouncedValue(search, 450);
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
    function applyDatePreset(days: 7 | 30 | 90): void {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days + 1);

        const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

        setDateFrom(toIsoDate(start));
        setDateTo(toIsoDate(end));
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

            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Log</h2>
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
                            <Button size="sm" variant="outline" onClick={() => applyDatePreset(7)}>
                                7 dias
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => applyDatePreset(30)}>
                                30 dias
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => applyDatePreset(90)}>
                                90 dias
                            </Button>
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
