# Matriz completa de permissões (Master Admin / Admin / Usuário)

Este documento é o checklist-base para o Master Admin marcar o que cada perfil pode:
- ver no menu/sidebar,
- abrir por página,
- executar por ação (listar/criar/editar/excluir/importar/exportar),
- enxergar em nível de dados (próprio autor vs todos).

## Perfis padrão atuais

- `master_admin`: acesso global + ações sensíveis (logs, backup, exclusões restritas).
- `admin`: acesso operacional amplo, com restrições em alguns recursos por autoria.
- `usuario`: foco em Entrevistas/Onboarding próprios + leitura de dados de referência.

## 1) Checklist de navegação (Sidebar)

Marque para cada perfil: `[ ] master_admin  [ ] admin  [ ] usuario`.

### Acesso geral
- [ ] `sidebar.settings.view` → `/transport/settings`
- [ ] `sidebar.activity-log.view` → `/transport/activity-log` (hoje só Master Admin)
- [ ] `sidebar.operations-hub.view` → `/transport/pendencias`

### Módulo Entrevistas
- [ ] `sidebar.dashboard.view` → `/transport/dashboard`
- [ ] `sidebar.interviews.view` → `/transport/interviews`
- [ ] `sidebar.interviews.create` → `/transport/interviews/create`
- [ ] `sidebar.next-steps.view` → `/transport/next-steps`
- [ ] `sidebar.onboarding.view` → `/transport/onboarding`

### Módulo Cadastro
- [ ] `sidebar.registry.collaborators.view` → `/transport/registry/collaborators`
- [ ] `sidebar.registry.users.view` → `/transport/registry/users`
- [ ] `sidebar.registry.functions.view` → `/transport/registry/functions`
- [ ] `sidebar.registry.payment-types.view` → `/transport/registry/payment-types`
- [ ] `sidebar.registry.plates-aviaries.view` → `/transport/registry/plates-aviaries`

### Módulo Folha
- [ ] `sidebar.payroll.dashboard.view` → `/transport/payroll/dashboard`
- [ ] `sidebar.payroll.launch.view` → `/transport/payroll/launch`
- [ ] `sidebar.payroll.list.view` → `/transport/payroll/list`
- [ ] `sidebar.payroll.adjustments.view` → `/transport/payroll/adjustments`
- [ ] `sidebar.payroll.report-unit.view` → `/transport/payroll/reports/unit`
- [ ] `sidebar.payroll.report-collaborator.view` → `/transport/payroll/reports/collaborator`

### Módulo Férias
- [ ] `sidebar.vacations.dashboard.view` → `/transport/vacations/dashboard`
- [ ] `sidebar.vacations.list.view` → `/transport/vacations/list`
- [ ] `sidebar.vacations.launch.view` → `/transport/vacations/launch`

### Módulo Fretes
- [ ] `sidebar.freight.dashboard.view` → `/transport/freight/dashboard`
- [ ] `sidebar.freight.launch.view` → `/transport/freight/launch`
- [ ] `sidebar.freight.list.view` → `/transport/freight/list`
- [ ] `sidebar.freight.spot.view` → `/transport/freight/spot`
- [ ] `sidebar.freight.canceled-loads.view` → `/transport/freight/canceled-loads`
- [ ] `sidebar.freight.timeline.view` → `/transport/freight/timeline`

## 2) Checklist de páginas e ações por módulo

## 2.1 Home
- [ ] `home.view` → ver cards disponíveis por perfil (`/api/home`)

## 2.2 Entrevistas e funil
- [ ] `interviews.list` → listar entrevistas
- [ ] `interviews.create` → criar entrevista
- [ ] `interviews.view` → abrir detalhes da entrevista
- [ ] `interviews.update` → editar entrevista
- [ ] `interviews.delete` → excluir entrevista
- [ ] `interviews.pdf` → gerar PDF da entrevista
- [ ] `interviews.filter.author` → filtrar por autor (hoje só Master)

- [ ] `next-steps.list` → listar aprovados para próximos passos
- [ ] `next-steps.mark-hired` → marcar contratação
- [ ] `next-steps.preview-document` → pré-visualizar documentos
- [ ] `next-steps.pdf-document` → gerar PDF de documentos

- [ ] `onboarding.list` → listar onboardings
- [ ] `onboarding.view` → abrir onboarding
- [ ] `onboarding.assign-responsible` → atribuir responsável
- [ ] `onboarding.update-item` → atualizar item/checklist
- [ ] `onboarding.upload-attachment` → anexar arquivo
- [ ] `onboarding.download-attachment` → baixar anexo
- [ ] `onboarding.complete` → concluir onboarding

## 2.3 Cadastro
- [ ] `registry.collaborators.list`
- [ ] `registry.collaborators.view`
- [ ] `registry.collaborators.create`
- [ ] `registry.collaborators.update`
- [ ] `registry.collaborators.delete`
- [ ] `registry.collaborators.import-xlsx`
- [ ] `registry.collaborators.export-csv`
- [ ] `registry.collaborators.upload-photo`

- [ ] `registry.users.list`
- [ ] `registry.users.create`
- [ ] `registry.users.update`
- [ ] `registry.users.delete`

- [ ] `registry.functions.list`
- [ ] `registry.functions.create`
- [ ] `registry.functions.update`
- [ ] `registry.functions.delete` (sensível)

- [ ] `registry.payment-types.list`
- [ ] `registry.payment-types.create`
- [ ] `registry.payment-types.update`
- [ ] `registry.payment-types.delete` (sensível)

- [ ] `registry.plates.list`
- [ ] `registry.plates.create`
- [ ] `registry.plates.bulk-create`
- [ ] `registry.plates.update`
- [ ] `registry.plates.delete` (sensível)

- [ ] `registry.aviaries.list`
- [ ] `registry.aviaries.create`
- [ ] `registry.aviaries.bulk-create`
- [ ] `registry.aviaries.update`
- [ ] `registry.aviaries.delete` (sensível)
- [ ] `registry.aviaries.import-xlsx`
- [ ] `registry.aviaries.export-csv`

- [ ] `registry.units.list` (endpoint de referência usado em filtros)

## 2.4 Folha
- [ ] `payroll.dashboard.view`
- [ ] `payroll.summary.view`
- [ ] `payroll.launch-candidates.view`
- [ ] `payroll.launch-batch.create`
- [ ] `payroll.launch-discount-preview.view`
- [ ] `payroll.reports.unit.view`
- [ ] `payroll.reports.collaborator.view`

- [ ] `payroll.payments.list`
- [ ] `payroll.payments.view`
- [ ] `payroll.payments.create`
- [ ] `payroll.payments.update`
- [ ] `payroll.payments.delete`

- [ ] `payroll.adjustments.discounts.list`
- [ ] `payroll.adjustments.discounts.create`
- [ ] `payroll.adjustments.discounts.update`
- [ ] `payroll.adjustments.discounts.delete`

- [ ] `payroll.adjustments.loans.list`
- [ ] `payroll.adjustments.loans.create`
- [ ] `payroll.adjustments.loans.update`
- [ ] `payroll.adjustments.loans.delete`

- [ ] `payroll.adjustments.pensions.list`
- [ ] `payroll.adjustments.pensions.create`
- [ ] `payroll.adjustments.pensions.update`
- [ ] `payroll.adjustments.pensions.delete`

## 2.5 Férias
- [ ] `vacations.dashboard.view`
- [ ] `vacations.list-eligible.view`
- [ ] `vacations.candidates.view`
- [ ] `vacations.launched.view`
- [ ] `vacations.collaborator-history.view`
- [ ] `vacations.launch.create`
- [ ] `vacations.launch.update`

## 2.6 Fretes
- [ ] `freight.dashboard.view`
- [ ] `freight.monthly-report.view`
- [ ] `freight.timeline.view`
- [ ] `freight.operational-report.view`

- [ ] `freight.entries.list`
- [ ] `freight.entries.create`
- [ ] `freight.entries.update`
- [ ] `freight.entries.delete`
- [ ] `freight.entries.import-preview`
- [ ] `freight.entries.import`

- [ ] `freight.spot.list`
- [ ] `freight.spot.create`

- [ ] `freight.canceled-loads.list`
- [ ] `freight.canceled-loads.update-trip-number`
- [ ] `freight.canceled-loads.bill`
- [ ] `freight.canceled-loads.unbill-one`
- [ ] `freight.canceled-loads.unbill-batch`
- [ ] `freight.canceled-loads.delete`
- [ ] `freight.canceled-load-batches.delete`

## 2.7 Configurações e Log
- [ ] `settings.view`
- [ ] `settings.password.update`
- [ ] `settings.backup.download` (sensível)
- [ ] `settings.users.create` (sensível)
- [ ] `activity-log.view` (sensível)

## 3) Checklist de visibilidade de dados (granular)

Marque para cada perfil se pode ver/detalhar dados de terceiros.

### Escopo de autoria
- [ ] `scope.interviews.all-authors`
- [ ] `scope.interviews.only-own`
- [ ] `scope.next-steps.all-authors`
- [ ] `scope.next-steps.only-own`
- [ ] `scope.onboarding.all-authors`
- [ ] `scope.onboarding.only-own-or-responsible`
- [ ] `scope.payroll.all-authors`
- [ ] `scope.payroll.only-own`
- [ ] `scope.freight.all-authors`
- [ ] `scope.freight.only-own`
- [ ] `scope.canceled-loads.all-authors`
- [ ] `scope.canceled-loads.only-own`

### Campos sensíveis
- [ ] `field.collaborator.documents` (CPF/RG/CNH)
- [ ] `field.collaborator.banking` (conta/agência/chave pix)
- [ ] `field.payroll.values` (valores detalhados)
- [ ] `field.payroll.author` (quem lançou)
- [ ] `field.vacations.author` (quem lançou)
- [ ] `field.interviews.author` (autor da entrevista)
- [ ] `field.audit-trail` (eventos/log técnico)

## 4) Estado atual do sistema (referência para migração)

- `master_admin`: acesso total; ações exclusivas em Log, Backup e exclusões restritas de alguns cadastros.
- `admin`: acesso a Fretes/Folha/Férias/Cadastro; em várias rotas pode listar global, mas editar/excluir alguns registros é restrito à própria autoria.
- `usuario`: hoje opera Entrevistas/Próximos Passos/Onboarding próprios; acesso de leitura em referências de cadastro (`unidades`, `placas`, `aviários`).

## 5) Pontos sensíveis para o novo módulo de permissões

- Separar claramente permissões de `menu` (ver item) e de `ação` (executar endpoint).
- Manter regra de escopo como permissão explícita (`all-authors` vs `only-own`) por módulo.
- Tratar operações críticas com chave dedicada (backup, exclusões restritas, gestão de usuários, log).
- Aplicar as mesmas chaves no frontend (exibição) e backend (bloqueio real da API).

## Evidências e fontes técnicas

- Rotas web: `routes/web.php`
- Rotas API: `routes/api.php`
- Menu/navegação: `resources/js/components/transport/admin-layout.tsx`
- Regras de papel: `app/Models/User.php`
- Policies: `app/Policies/DriverInterviewPolicy.php`, `app/Policies/OnboardingPolicy.php`
- Controllers com bloqueios por papel/autoria:
	- `app/Http/Controllers/Api/PayrollController.php`
	- `app/Http/Controllers/Api/FreightController.php`
	- `app/Http/Controllers/Api/FreightCanceledLoadController.php`
	- `app/Http/Controllers/Api/Registry/*`
	- `app/Http/Controllers/Api/TransportSettingsController.php`
	- `app/Http/Controllers/Api/ActivityLogController.php`
