# Changelog

## [2026-03-20] - Correção de log diário e desconto parcelado da folha

### Plataforma

- Corrigido o agrupamento do Update Log interno de produto para evitar classificação indevida de todas as entregas em `Painel de Cadastro`.
- Entrada do log diário ajustada para a data correta (`Sexta-Feira, 20/03/2026`) com separação por contexto operacional: Cadastro, Plataforma, Gestão de Fretes e Painel de Folha.
- Executada varredura técnica completa com suíte de backend (`php artisan test`) totalmente verde (`119 passed`) após ajuste de cenário de filtro em entrevistas compatível com visibilidade por autor.
- Corrigidos erros de lint no frontend/mobile (ordem de imports, variáveis não utilizadas, escapes desnecessários e estabilização de dependências de hooks) com `npm run lint:check` e `npm run types` aprovados.
- Dívida de estilo PHP foi zerada com `composer lint` (Pint), corrigindo 46 apontamentos e deixando `composer test:lint` totalmente verde.
- Rodada final de validação repetida após os ajustes: backend completo, lint/types/build no frontend, `migrate --force`, `optimize:clear + optimize` e health check no domínio fixo com HTTP `200`.
- Padronização global de UX aplicada no layout administrativo com barra de comando unificada em todas as telas (`Ctrl+S`, `Alt+Q`, `Alt+A`) para reduzir variação de uso entre módulos.
- Incluído `Modo foco` persistido em `localStorage` para operação contínua em desktop, ocultando a sidebar durante tarefas de lançamento em lote e edição prolongada.
- Hardening de segurança adicionado com middleware `MonitorSuspiciousApiActivity`, detectando rajadas de 401/403/419 e aplicando bloqueio temporário por IP em abuso de API.
- Performance otimizada com cache curto da Home por fingerprint de permissões/período e cache de permissões por cargo no `RolePermissionCatalog` com invalidação automática.
- Atualização de permissões por função agora incrementa versão global de cache para refletir rapidamente mudanças de acesso na Home sem depender de expiração longa.
- Toast compartilhado (`Notification`) passou a auto-fechar por padrão em 5s e ganhou ação de fechar manualmente, corrigindo casos de mensagem fixa na tela após operações concluídas.
- Limpeza de dados de simulação executada no banco: unidade/cadastro temporários removidos e descontos órfãos relacionados excluídos para manter base operacional consistente.
- Hardening adicional aplicado nas rotas de Entrevistas, Próximos Passos e Onboarding com `throttle:transport-heavy` em ações sensíveis (status, contratação, conclusão e geração de documentos).
- `api-client` recebeu timeout padrão, deduplicação de requisições GET em voo e emissão de evento global de erro (`transport:api-error`) para reforçar observabilidade e UX em falhas.
- Layout administrativo passou a ouvir eventos globais de erro da API e exibir feedback padronizado em toast sem depender de implementação manual em cada tela.
- Criado comando operacional `php artisan transport:cleanup-simulation` (com `--dry-run`) para limpeza repetível de dados de simulação e órfãos em ambiente operacional.
- Componente de notificação recebeu melhoria de acessibilidade no botão de fechar com destaque de foco via teclado (`focus-visible`).
- Limpeza manual complementar removeu resíduos de simulação no cadastro (funções, tipos de pagamento e registros auxiliares com nome de teste) para impedir poluição visual/operacional.
- Lançar Fretes passou a converter corretamente campos inteiros com milhar em formato pt-BR (ex.: `242.666`), evitando perda de escala na lista de fretes.
- Cadastro de Colaboradores recebeu novo campo `Adiantamento Salarial (S/N)` com persistência completa em banco e edição rápida no perfil.
- Lançar Pagamentos passou a auto-marcar colaboradores com `Adiantamento Salarial = S` quando tipo de pagamento de adiantamento é selecionado, mantendo edição manual livre da seleção.
- Pendências (`/transport/pendencias`) agora exibe explicação curta em cada card para facilitar leitura operacional sem ambiguidade.
- Cards de Pendências tiveram hierarquia visual reforçada: título principal em destaque (preto/negrito/maior) e descrição em linha secundária para leitura mais rápida.
- Modo foco recebeu sidebar inteligente por hover no desktop: ao encostar o mouse na borda esquerda o menu lateral abre, e recolhe ao sair da área.
- No modo foco, quando a sidebar por hover é exibida, o conteúdo principal também desloca para a direita e retorna ao retrair, evitando sobreposição de conteúdo.
- Grid de cards do Pendências foi memoizada para reduzir recomposição desnecessária da tela durante re-render.
- Varredura completa em todas as telas do módulo de transporte aplicada com padronização visual de títulos/espaçamentos (Fretes Lista, Fretes Dashboard e Log) para manter consistência global de UX.
- Overlays de Fretes (dropdown custom e tooltip da Central Analítica) tiveram `z-index` elevado para reduzir risco de conflito de camadas com componentes flutuantes.
- App mobile (`mobile/driver-app`) recebeu scripts de qualidade `lint` e `typecheck`, entrando na rotina de varredura automática junto com web/backend.
- Motoristas informados em lista operacional foram atualizados em lote para `Adiantamento Salarial = S` no cadastro de colaboradores.
- Lista de Pagamentos foi corrigida para consolidar carregamento completo por filtros antes do agrupamento, eliminando paginação incoerente (muitas páginas para poucos lançamentos agrupados).
- Lançar Pagamentos ganhou ordenação por nome (crescente/decrescente) no cabeçalho da coluna `Nome`.
- Cadastro de Colaboradores passou a abrir com filtro padrão `Ativos` e converte automaticamente preferência legada `Todos` para `Ativos`.
- Listas de Fretes e Pagamentos receberam exportação direta em `XLSX` com novos endpoints de download.
- A coluna de ações em Pagamentos foi compactada para ícones (visualizar/editar/imprimir/excluir), reduzindo poluição visual em telas com muitos lançamentos.
- Lançar Pagamentos agora bloqueia combinações entre tipos salariais (`Adiantamento`, `Décimo Terceiro`, `Salário Mensal`) e tipos de benefícios/extras no mesmo lançamento, com desabilitação visual dos grupos conflitantes.
- Ao selecionar `Cesta Básica` no lançamento, a tabela exibe campo global no topo da coluna para aplicar valor fixo automaticamente em todos os colaboradores marcados.
- Descontos de Folha passaram a suportar prioridades múltiplas de aplicação (`prioridade 1`, `2`, `3`) por colaborador, com consumo sequencial por tipo e suporte a acúmulo quando a prioridade disponível no mês não cobre a parcela.
- Na Lista de Pagamentos, somente o botão de imprimir permanece em verde; visualizar/editar foram normalizados para preto.
- Corrigido bug no Lançar Pagamentos em que alguns valores eram exibidos/travados sem interação do usuário ao carregar colaboradores; a grade volta a iniciar sem auto-preenchimento indevido.
- Campo global de valor da `Cesta Básica` passou a aparecer corretamente no topo da tabela sempre que o tipo estiver selecionado, mesmo sem VR/VT ativos.
- Corrigido o auto-check do `Adiantamento Salarial = S` no Lançar Pagamentos para também funcionar quando os colaboradores são carregados após a seleção do tipo de adiantamento.
- Impressão dos tipos de benefícios/extras (colunas 2 e 3) foi reformatada para planilha em paisagem com layout compacto e colunas fixas: `NOME`, `DIAS ÚTEIS`, `VR`, `PRÊMIO`, `VT`, `EXTRAS`, `CB`, `DESCONTOS`, `TOTAL CARTÕES` e `A PAGAR DINHEIRO`.
- Na impressão de benefícios/extras, os totais operacionais agora seguem as fórmulas: `TOTAL CARTÕES = VR + PRÊMIO + CB` e `A PAGAR DINHEIRO = VT + EXTRAS - DESCONTOS`.
- A impressão dos tipos salariais da coluna 1 (`Salário Mensal`, `Adiantamento`, `Décimo Terceiro`) foi preservada sem alterações de layout/regra.
- `Dias úteis` passou a ser persistido no lançamento em lote de pagamentos (payload + backend), armazenado em `observacao` e reaplicado ao abrir edição de lançamento completo.
- Com a persistência, o campo `DIAS ÚTEIS` agora aparece na impressão de benefícios/extras para lançamentos salvos com essa informação.
- Exportação XLSX da Lista de Pagamentos foi convertida para resumo mensal por colaborador com base apenas em `competência mês/ano` dos filtros.
- Nova planilha de exportação contém colunas `Nome`, `VR` e `VA`, somando todos os lançamentos do mês por pessoa.
- Regra de cálculo aplicada na planilha: `VR` = apenas Vale Refeição; `VA` = `Prêmio Média + Cesta Básica`.
- A planilha inclui título superior da competência no formato `Mês/AA` (ex.: `Março/26`) e linha final com total geral de `VR` e `VA`.
- Corrigido bug na exportação VR/VA que poderia gerar colunas vazias mesmo com lançamentos no mês: a identificação dos tipos agora normaliza variações de acentuação/nome e usa fallback por `tipo_pagamento_id`.

### Painel de Folha

- Corrigida a prévia de descontos no fechamento: descontos parcelados agora respeitam competência mensal e aplicam somente a parcela do mês (ex.: `R$ 250,00` em `5x` aplica `R$ 50,00` por mês).
- O saldo restante de desconto passou a refletir corretamente o total ainda pendente após as parcelas vencidas/aplicadas, sem consumo integral em um único fechamento.
- Adicionado teste de regressão em `PayrollApiTest` cobrindo o cenário de desconto parcelado para evitar recidiva.

## [2026-03-17] - Kit de deploy persistente em VPS + automação inicial

### Gestão de Fretes

- Entregue kit de infraestrutura versionado para publicação em servidor Linux sem dependência do notebook local:
  - `.env.production.example`
  - `scripts/deploy/provision-ubuntu.sh`
  - `scripts/deploy/server-deploy.sh`
  - `scripts/deploy/nginx-kaique-entrevista.conf.template`
  - `scripts/deploy/supervisor-laravel-worker.conf.template`
- Adicionado workflow opcional de deploy contínuo por SSH em `.github/workflows/deploy-production.yml` para executar publicação no servidor ao enviar mudanças para `main`.
- Documentado runbook operacional completo em `documentos/deploy-vps.md` (DNS, provisionamento, Nginx, SSL, Supervisor, cron e checklist de validação).
- Criado MVP do app mobile de motoristas em `mobile/driver-app` com login por token Sanctum (`/api/login`), sessão persistida no aparelho e consulta de perfil autenticado (`/api/me`).
- Incluído guia para leigos de execução no celular em `mobile/driver-app/README.md` com fluxo completo via Expo Go.
- Adicionado `mobile/driver-app/eas.json` para build de APK em nuvem (Expo EAS) com perfil `preview` de distribuição interna.
- Reforçado passo a passo simplificado no guia mobile para dois cenários: teste imediato por QR (Expo Go) e distribuição em massa por APK.
- Atualizado app mobile para Expo SDK 54 (React 19.1 / React Native 0.81.5) com dependências alinhadas e validação `expo-doctor` sem pendências.
- Ajustado guia mobile para uso exclusivo do domínio fixo `https://app.kaiquetransportes.com.br` e esclarecimento de instalação APK fora do Expo Go.
- Removida a confirmação de "ação crítica" no lançamento em lote de pagamentos (`/payroll/launch-batch`), eliminando o bloqueio indevido durante operação normal.
- Fluxo de lançamento de pagamentos ajustado para tratar colaboradores selecionados com valor zerado como ignorados (sem erro crítico), mantendo foco/alerta informativo quando todos os selecionados estão sem valor.
- Cadastro/Edição de colaboradores simplificado: retirada da validação rígida de RG (9 dígitos + 1 caractere) e remoção dos campos redundantes `Endereço completo`, `Dados bancários 1` e `Dados bancários 2` do formulário.
- Correção transversal da ação crítica: operações `DELETE` comuns (ex.: exclusões de rotina em pagamentos/listas) deixaram de disparar confirmação crítica automática; a confirmação agora ocorre apenas em rotas explicitamente sensíveis.
- Matriz de permissões foi expandida para checklist completo do Master Admin em `documentos/transport-permissions-matrix.md`, cobrindo menu/sidebar, páginas, ações por endpoint e visibilidade granular de dados (próprio autor vs todos).
- `Cadastro > Usuários` recebeu bloco direto “O que cada perfil faz” com resumo prático de Master Admin, Admin e Usuário na própria tela de criação/edição de acessos.
- Log interno do dia 17/03/2026 foi recategorizado para `Painel de Cadastro` nesse item de permissões, removendo classificação incorreta em `Gestão de Fretes`.
- Implementada tela real de gestão de permissões por função em `Cadastro > Usuários` com checklist completo de painéis, páginas de sidebar, ações e visibilidade de dados por cargo (`master_admin`, `admin`, `usuario`).
- Criada persistência de permissões em banco (`role_permissions`) + APIs de leitura/edição (`/api/registry/role-permissions`) para uso exclusivo de Master Admin.
- Sessão autenticada passou a retornar permissões efetivas no `/api/me` e login, permitindo renderização dinâmica de navegação conforme o cargo configurado.
- Política/controlador de Entrevistas foram conectados às permissões dinâmicas, incluindo controle explícito da visibilidade de entrevistas de outros usuários.
- Removido integralmente o fluxo de “Ação Crítica” no frontend e backend: sem popup de confirmação, sem header `X-Confirm-Action` e sem bloqueio HTTP `428` na API.
- Importações e operações operacionais (incluindo XLSX em Lançar Fretes) voltaram ao fluxo normal sem interceptação por confirmação crítica.
- Modal "Permissões por função" em Cadastro de Usuários foi ajustado para rolagem completa vertical (conteúdo interno com scroll), permitindo acessar todos os grupos e checkboxes sem corte.
- Arquivo legado de middleware de ação crítica foi removido do projeto, mantendo apenas referência histórica no changelog.
- Home passou a respeitar permissões configuradas por função para exibição de painéis (sem precisar abrir módulo por URL), com leitura baseada nas permissões de sidebar.
- Modal de permissões ganhou botão direto `Ver painéis na Home` para validar imediatamente o resultado da configuração.
- Correção no Lançar Fretes: campos inteiros de aves/viagens/veículos agora normalizam sempre para inteiro no payload, evitando erro de validação quando o usuário digita milhar no padrão pt-BR (ex.: `233.222`).
- Performance da Home melhorada com cálculo condicional de métricas: consultas pesadas só rodam para painéis realmente permitidos ao perfil.

## [2026-03-16] - Fechamento de pendências (navegação, permissões, smoke e testes críticos)

### Gestão de Fretes

- Removida a superfície do `Executive Dashboard` (links, rota web direta, rota API e feature flags), mantendo o fluxo operacional concentrado em `Pendências`.
- Renomeado o Hub Operacional para `Pendências` com nova rota principal `/transport/pendencias` e redirecionamento de compatibilidade a partir de `/transport/operations-hub`.
- Sidebar reorganizada em duas áreas (`Navegação do módulo` e `Acesso geral`) com ajuste de rolagem para manter `Sair` sempre visível.
- Dashboards de fretes, folha, férias e entrevistas foram refinados para indicadores mais acionáveis no contexto operacional.

### Plataforma

- Criado util compartilhado de formatação em `resources/js/lib/transport-format.ts` e aplicado nas principais telas de Fretes/Folha/Entrevistas para padronizar data, moeda, inteiros e percentuais.
- Incluída matriz de permissões por papel em `documentos/transport-permissions-matrix.md` com regras finais para Fretes, Folha, Férias e Entrevistas.
- Ampliada cobertura de testes de fluxo crítico e permissões com novo arquivo `tests/Feature/Api/PayrollVacationApiTest.php` e novos cenários em `FreightApiTest`, `PayrollApiTest` e `DriverInterviewApiTest`.
- Revalidação executada: build frontend OK, migrações OK, suíte crítica de API OK (`37 passed`) e smoke no domínio público fixo `https://app.kaiquetransportes.com.br` com HTTP `200`.

## [2026-03-16] - Correções críticas de uso diário (fretes/pagamentos/entrevistas)

### Gestão de Fretes

- Corrigida a formatação de moeda na `Lista de Fretes` para tratar corretamente valores decimais vindos da API sem inflar milhares.
- Corrigido bug de data exibindo dia anterior na `Lista de Fretes` (efeito de timezone no navegador).
- Ajustado limite de paginação da API de fretes para até `500` itens, evitando corte de dados no carregamento mensal do dashboard.
- Reforçado parsing de moeda em `Fretes Spot` e `Cargas Canceladas` para suportar entradas em formatos mistos com fallback seguro.
- Cadastro de `Aviários` ajustado para KM inteiro (sem exibição `.00`) na listagem e no formulário de edição/cadastro.
- Removidos tooltips nativos nas ações de `Colaboradores` (`ver`, `editar`, `excluir`) para eliminar a caixa branca no hover e manter UX enxuta por ícones.
- Adicionado pacote modular por feature flags para habilitar/desabilitar rapidamente: `security_headers`, `sensitive_audit`, `operations_hub`, `executive_dashboard`, `csv_exports`, `collaborator_index_cache`.
- Criados exports CSV autenticados em Cadastro para `colaboradores` e `aviarios` com download direto no frontend.
- Incluídas novas visões operacionais: `Operations Hub` (pendências) e `Executive Dashboard` (KPIs/alertas) com endpoints dedicados.
- Aplicado cache curto na listagem padrão de colaboradores para reduzir carga em consultas repetidas sem filtros.
- Tabela de `Lançamentos principais` em Fretes passou a exibir `KM` como inteiro com milhar (sem `,00`).
- `Operations Hub` e `Dashboard Executivo` foram movidos dos cards centrais da Home para a área fixa da sidebar (junto de Log/Config), reduzindo ruído no fluxo de lançamento operacional.

### Plataforma

- Padronizada a exibição de datas em telas de Pagamentos e Entrevistas para reduzir inconsistências de dia entre usuários/navegadores.
- Blindado parsing/formatting monetário em telas de Pagamentos (`dashboard`, `lista`, `lançamento` e `ajustes`) para eliminar inflação de valores por locale.
- Lista de `Colaboradores` teve ações simplificadas para ícones (`ver`, `editar`, `excluir`) com feedback visual de botão/hover alinhado às demais telas.
- Middleware global de segurança adicionado com CSP e cabeçalhos de proteção (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` e HSTS quando HTTPS).
- Auditoria automática de ações sensíveis de API adicionada para trilha de alterações em operações críticas de cadastro e financeiros.
- Entrevistas passaram a suportar `Data de nascimento` no backend e frontend (formulário de cadastro/edição + tela de visualização).

## [2026-03-15] - Hardening de segurança + otimização ampla

### Segurança e Robustez

- Endpoints de frete receberam validação rigorosa de entrada (datas, paginação e filtros), reduzindo risco de payload inválido e consultas excessivas.
- Timeline de fretes agora limita intervalo máximo em `366 dias`, mitigando abuso de recurso e travamentos por consulta muito ampla.
- Novos limites de taxa (`throttle`) aplicados em rotas críticas:
  - `transport-heavy` para relatórios pesados
  - `transport-backup` para geração de backup

### Performance

- Timeline de fretes foi otimizada com agregação por SQL (unidade + data), diminuindo processamento em memória no backend.
- Adicionado índice composto para relatórios de pagamentos por autor/colaborador/competência:
  - `pagamentos_autor_colab_competencia_index`

### Testes e Correções

- Incluídos testes de proteção para fretes:
  - rejeição de intervalo acima de 1 ano na timeline
  - validação de formato de data inválido na listagem
- Suite de fretes e regressão geral revalidadas após as mudanças.

## [2026-03-14] - Estabilização geral de erros + ganho de fluidez

### Qualidade e Performance

- Corrigidos erros de lint remanescentes com ajustes de hooks/effects que estavam gerando renderizações em cascata.
- Removidos padrões de `setState` síncrono dentro de `useEffect` em telas críticas (fretes/férias), reduzindo stutter em mudanças de filtros.
- Refinadas dependências de hooks (`useMemo`/`useEffect`) para evitar recomputações desnecessárias.
- Mantido e expandido o prefetch da navegação lateral para melhorar percepção de velocidade na troca de páginas.

### API e Testes

- Ajustado `PayrollController` para manter compatibilidade com `total_pago_mes` no relatório por unidade.
- Corrigido período padrão de competência para cobrir o ano corrente quando não há filtros explícitos.
- Atualizado `HomeApiTest` para refletir a inclusão do módulo de férias sem acoplamento frágil por índice fixo.
- Suíte automatizada revalidada com sucesso (após os ajustes): testes de API e frontend estático (lint/types/build).

## [2026-03-13] - Central Analítica unificada + Sidebar minimizável

### Gestão de Fretes

- A antiga visão de Inteligência foi consolidada na `Central Analítica` com alternância interna de seções:
  - `Tendência diária`
  - `Operacional`
  - `Análise mensal`

- Nomenclatura do módulo ajustada no menu para reforçar o novo fluxo:
  - `Central de Fretes` (painel)
  - `Central Analítica` (entrada principal de análise)

- Gráfico diário recebeu controle rápido de período no estilo operacional:
  - `1S`, `1M`, `1A`, `5A`, `Máx`
  - mantendo também filtros manuais por data inicial/final

- Tooltip por ponto mantido com leitura direta de:
  - unidade
  - data
  - valor

### Navegação

- Sidebar com modo minimizável:
  - menu expandido/compacto com persistência em `localStorage`
  - no modo compacto, navegação por ícones e logo reduzida

## [2026-03-13] - Pré-preenchimento de XLSX em Fretes + UX de Ações

### Gestão de Fretes

- Importação XLSX do `Lançar Fretes` foi alterada para **pré-preenchimento**:
  - O arquivo agora preenche o formulário na tela sem salvar automaticamente.
  - O usuário confere os valores e só então clica em `Salvar lançamento`.
  - Inclui preenchimento de cargas canceladas escaladas quando presentes no XLSX.

- Adicionado novo endpoint para pré-visualização da planilha:
  - `POST /api/freight/entries/import-spreadsheet-preview`

- Sidebar de fretes restaurada com atalhos que haviam sido enxugados:
  - `Relatório Operacional`
  - `Análise Mensal`
  - Mantida `Inteligência de Fretes`

- Melhorias visuais na página `Inteligência de Fretes`:
  - Eixo diário contínuo (todos os dias entre início e fim)
  - Linhas com espessura uniforme
  - Tooltip por bolinha com unidade, data e valor

### UX Geral

- Ações de tabela convertidas para estilo com ícones (sem texto) em telas principais:
  - Entrevistas (`Ver`, `Editar`, `Excluir`)
  - Cadastro (`Usuários`, `Funções`, `Tipos de Pagamento`, `Placas e Aviários`)
  - Lista de lançamentos em `Lançar Fretes`

### Preparação Mobile

- Criado roadmap técnico para app de motoristas integrado ao sistema:
  - `documentos/mobile-motoristas-roadmap.md`

## [2026-03-12] - Correções Lista de Fretes e Férias

### Corrigido

- Corrigida a tela branca em Lista de Fretes.
  - A página estava quebrando por causa de um `SelectItem` com valor vazio e também por usar rotas divergentes do restante do módulo.
  - Ajustado para usar `/registry/unidades` e `/freight/entries`.
  - O filtro de unidade agora usa `all` em vez de valor vazio.

- Corrigido o fluxo de editar vindo da Lista de Fretes.
  - Ao clicar em editar na lista, a tela de lançar fretes agora abre já em modo de edição do item selecionado via query string `?edit=`.

- Atualizada a sidebar de férias.
  - O item `Lista` virou `Lista de Férias`.

### Novas mudanças em Férias

- A tela [resources/js/pages/transport/vacations/list.tsx](resources/js/pages/transport/vacations/list.tsx) foi refeita com duas abas:
  - `A realizar`
  - `Realizadas`

- As duas listas agora têm ordenação por coluna com setas.

- A lista `A realizar` mostra todos os colaboradores retornados pelo cálculo de elegibilidade com:
  - nome
  - função
  - unidade
  - início do período aquisitivo
  - fim do período aquisitivo
  - direito
  - limite
  - status

- A lista `Realizadas` mostra todos os lançamentos já feitos com:
  - nome
  - função
  - unidade
  - início
  - fim
  - período aquisitivo
  - dias
  - abono
  - autor

- Adicionada nova rota de API para férias realizadas:
  - `/api/payroll/vacations/launched`

- Corrigido o preenchimento automático do período aquisitivo em lançar férias.
  - O início continua preenchido a partir do colaborador.
  - O fim agora é calculado automaticamente como `início + 364 dias`.
  - O campo final ficou somente leitura para evitar divergência.

### Arquivos impactados

- [resources/js/pages/transport/freight/list.tsx](resources/js/pages/transport/freight/list.tsx)
- [resources/js/pages/transport/freight/launch.tsx](resources/js/pages/transport/freight/launch.tsx)
- [resources/js/pages/transport/vacations/list.tsx](resources/js/pages/transport/vacations/list.tsx)
- [resources/js/pages/transport/vacations/launch.tsx](resources/js/pages/transport/vacations/launch.tsx)
- [resources/js/components/transport/admin-layout.tsx](resources/js/components/transport/admin-layout.tsx)
- [app/Http/Controllers/Api/PayrollVacationController.php](app/Http/Controllers/Api/PayrollVacationController.php)
- [routes/api.php](routes/api.php)

### Validação

- `npm run types` OK
- `npm run build` OK

## [2026-03-13] - Ajustes de usabilidade no Perfil e Gestão de Fretes

### Perfil de Colaboradores

- Melhorada a edição nas seções de baixo do perfil em [resources/js/pages/transport/registry/collaborators.tsx](resources/js/pages/transport/registry/collaborators.tsx):
  - Contato e Dados bancários agora exibem dica visual explícita para edição por duplo clique.
  - Férias ganhou botão Editar por linha (além do lançamento novo).
  - Afastamentos ganhou botão Editar por linha (além do duplo clique na linha).

- Modal de férias do perfil agora suporta criação e edição:
  - título dinâmico (novo/edição)
  - botão dinâmico (gravar/salvar alterações)

### API de Férias

- Adicionado endpoint de atualização de férias:
  - `PUT /api/payroll/vacations/{feriasLancamento}`
  - arquivos: [routes/api.php](routes/api.php), [app/Http/Controllers/Api/PayrollVacationController.php](app/Http/Controllers/Api/PayrollVacationController.php)

### Lista de Fretes

- Corrigida formatação de números em [resources/js/pages/transport/freight/list.tsx](resources/js/pages/transport/freight/list.tsx):
  - Frete com `R$` e casas decimais (pt-BR)
  - Cargas/Aves/Veículos com separador de milhar
  - KM como inteiro (sem `.00`)

- Corrigido endpoint de exclusão de lançamentos na lista:
  - de `/transport/freight/entries/{id}` para `/freight/entries/{id}`

### Home e números quebrados

- Corrigida exibição de métricas com muitos decimais em [resources/js/pages/transport/home.tsx](resources/js/pages/transport/home.tsx):
  - valores monetários formatados como moeda
  - contagens formatadas como inteiros

### Sidebar de Fretes (enxugada)

- Simplificada navegação em [resources/js/components/transport/admin-layout.tsx](resources/js/components/transport/admin-layout.tsx):
  - removidos itens separados de Relatório Operacional e Análise Mensal
  - Linha do Tempo renomeada para Inteligência de Fretes

### Inteligência de Fretes (Linha do Tempo)

- Melhorada página [resources/js/pages/transport/freight/timeline.tsx](resources/js/pages/transport/freight/timeline.tsx):
  - gráfico com pontos por dia (bolinhas)
  - linhas por unidade com preenchimento de dias sem lançamento
  - cards de resumo (total, média diária, pico, dias)
  - tabela analítica por unidade (total, média, maior/menor dia, dias com movimento)

### Validação

- `npm run types` OK
- `npm run build` OK

## [2025-03-12] - Sistema de Transporte - Big Update

### ✨ Novas Funcionalidades

#### 1. **Atalho de Navegação Global (Ctrl+K)**
- Implementado sistema de navegação rápida globalmente acessível
- Funcionalidade:
  - Pressione **Ctrl+K** em qualquer tela
  - Abre um diálogo de navegação
  - Digite o número para navegar:
    - **1** → Entrevistas
    - **2** → Pagamentos  
    - **3** → Férias
    - **4** → Cadastro (Colaboradores)
    - **5** → Gestão de Fretes
  - Pressione ESC para fechar
- **Arquivo modificado:** `resources/js/components/transport/admin-layout.tsx`

#### 2. **Atalho Alt+A - Save (CORRIGIDO)**
- Corrigido o atributo de identificação dos botões de salvar
- Mudou de `data-alt-a-save` para `data-save-action`
- Agora funciona em todas as telas:
  - Alt+A nos Fretes (Launch) → Salva o lançamento
  - Alt+A nos Colaboradores → Salva alterações do perfil
  - Alt+A em modais de formulário → Salva e fecha
- **Arquivos modificados:**
  - `resources/js/components/transport/admin-layout.tsx` (atualizado seletor)
  - `resources/js/pages/transport/freight/launch.tsx` (adicionado atributo)

#### 3. **Nova Página: Lista de Fretes**
- Criada página dedicada para visualizar todos os lançamentos de fretes
- Funcionalidades:
  - Tabela com todos os lançamentos
  - Filtros por:
    - Unidade
    - Data
  - Ações por linha:
    - **Editar** → Abre lançamento no modo de edição
    - **Deletar** → Remove lançamento com confirmação
  - Botão "Novo lançamento" → Redireciona para tela de lançamento
  - Integração com API existente
- **Arquivos criados/modificados:**
  - `routes/web.php` (adicionada rota `/transport/freight/list`)
  - `resources/js/pages/transport/freight/list.tsx` (novo arquivo)
  - `resources/js/components/transport/admin-layout.tsx` (adicionada opção no menu)

#### 4. **Import XLSX com Suporte a Dois Formatos**
- Sistema de importação inteligente que detecta automaticamente o formato
- **Formato 1: Kaique (Novo)**
  - Mapeia dados de células específicas:
    - B1: DATA
    - B2: UNIDADE
    - B3: VEÍCULOS UTILIZADOS
    - B4-B23: Demais campos (frete_programado, cargas, aves, km, etc.)
    - A30+: Cargas canceladas escaladas (AVIARIO, PLACA em C, FRETE em D)
  - Processa dados únicos por data/unidade
  - Suporta múltiplas cargas canceladas escaladas (linhas 30+)

- **Formato 2: Padrão (Mantido)**
  - Importação baseada em cabeçalhos (linha 1)
  - Suporta múltiplas linhas de dados (a partir de linha 2)
  - Compatível com planilhas genéricas

- **Detecção Automática:** Se célula A1 contém "DATA", usa formato Kaique; caso contrário, usa formato padrão
- **Arquivo modificado:** `app/Http/Controllers/Api/FreightController.php`
  - Novo método: `importKaiqueFormatSpreadsheet()`
  - Novo método: `importStandardFormatSpreadsheet()`
  - Método principal `importSpreadsheet()` agora detecta e delega para o formato apropriado

### 🐛 Correções

1. **TypeScript Compilation**
   - Adicionado import de `React` em `resources/js/pages/transport/freight/list.tsx`
   - Removido tipo de retorno explícito que causava erro JSX.Element
   - Corrigida configuração do componente Notification

2. **Atributo Save Button**
   - Padronizado uso de `data-save-action="true"` em todos os botões save
   - Atualizador do seletor admin-layout de `data-alt-a-save` para `data-save-action`

### 📝 Detalhes Técnicos

**Componentes Modificados:**
- `resources/js/components/transport/admin-layout.tsx` (385 linhas)
  - Adicionado estado para navegação: `navigationOpen`, `navigationInput`
  - Novo useEffect para detectar Ctrl+K
  - Novo objeto `navigationOptions` com as 5 opções
  - Novo handler `handleNavigationInput()`
  - Nova Dialog para exibir navegação
  - Atualizado seletor do botão save para `data-save-action`

- `resources/js/pages/transport/freight/launch.tsx`
  - Adicionado `data-save-action="true"` ao botão de salvar

**Arquivos Criados:**
- `resources/js/pages/transport/freight/list.tsx` (520 linhas)
  - Sistema de listagem com filtros
  - Integração com API `/transport/freight/entries`
  - Modals de confirmação de deletagem
  - Estadio de carregamento

- `CHANGELOG.md` (este arquivo)

**Arquivos Modificados (Backend):**
- `app/Http/Controllers/Api/FreightController.php`
  - Refatorado `importSpreadsheet()` para detectar formato
  - Adicionado `importKaiqueFormatSpreadsheet()` (200+ linhas)
  - Adicionado `importStandardFormatSpreadsheet()` (140+ linhas)
  - Mapeamento de células: B1-B23 para dados principais
  - Processamento de cargas canceladas (linhas A30+)

- `routes/web.php`
  - Adicionada rota: `GET /transport/freight/list` → `transport.freight.list`

### 🚀 Deploy Checklist

- [x] TypeScript compila sem erros
- [x] Build produção completo (npm run build)
- [x] Testado em desenvolvimento local

**Próximas ações (produção):**
- [ ] Enviar arquivos modificados para hospedagem
- [ ] Executar migrações (se necessário)
- [ ] Limpar cache da aplicação
- [ ] Testar import XLSX em produção
- [ ] Testar Ctrl+K em produção
- [ ] Testar Alt+A em todas as telas
- [ ] Verficar nova página Lista de Fretes

### 📦 Arquivos para Deploy

**Novos arquivos:**
```
resources/js/pages/transport/freight/list.tsx
CHANGELOG.md
```

**Arquivos modificados:**
```
routes/web.php
resources/js/components/transport/admin-layout.tsx
resources/js/pages/transport/freight/launch.tsx
app/Http/Controllers/Api/FreightController.php
```

### ⚡ Comandos para Deploy

```bash
# 1. Fazer build
npm run build

# 2. Copiar arquivos modificados para hospedagem
# (usando seu método usual de deploy)

# 3. Executar artisan se necessário
php artisan optimize:clear
php artisan config:cache

# 4. Testar em produção
# - Abrir app e testar Ctrl+K
# - Testar Alt+A em várias telas
# - Acessar /transport/freight/list
# - Testar import XLSX
```

### 📋 Notas Importantes

1. **Compatibilidade:** Todas as mudanças são backward-compatible. Código antigo continua funcionando.

2. **Import XLSX:** O novo formato Kaique é detectado automaticamente. Planilhas antigas continuam funcionando.

3. **TypeScript:** Sem erros, sem warnings (tipos corrigidos).

4. **Performance:** Sem impacto negativo. Novo atributo `data-save-action` usa seletor CSS simples.

---

**Desenvolvido em:** 12 de Março de 2025
**Versão:** 1.0.0
**Status:** ✅ Pronto para Deploy
