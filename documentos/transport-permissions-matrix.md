# Matriz de permissões (Admin / Master Admin / Usuário)

## Escopo validado
- Fretes (lançamento/lista/dashboard/timeline)
- Folha (pagamentos, dashboard e relatórios)
- Férias (dashboard, lista, candidatos, lançadas, histórico, criar/editar)
- Entrevistas (listagem, criação, leitura, atualização, exclusão, PDF)

## Regras por módulo

### Fretes
- `admin`: permitido
- `master_admin`: permitido
- `usuario`: proibido (`403`)
- Observação: endpoints de fretes exigem `isAdmin() || isMasterAdmin()` no controller.

### Folha
- `admin`: permitido
- `master_admin`: permitido
- `usuario`: proibido (`403`)
- Observação: endpoints de folha exigem `isAdmin() || isMasterAdmin()` no controller.

### Férias
- `admin`: permitido
- `master_admin`: permitido
- `usuario`: proibido (`403`)
- Observação: todos os endpoints de férias exigem `isAdmin() || isMasterAdmin()` no controller.

### Entrevistas
- `admin`: permitido (somente registros do próprio autor, exceto master)
- `master_admin`: permitido (acesso global, inclusive filtro por autor e PDF de qualquer registro)
- `usuario`: permitido para criar e operar os próprios registros
- Observação: controle feito por `DriverInterviewPolicy`.

## Evidências automatizadas
- `tests/Feature/Api/FreightApiTest.php`
- `tests/Feature/Api/PayrollApiTest.php`
- `tests/Feature/Api/PayrollVacationApiTest.php`
- `tests/Feature/Api/DriverInterviewApiTest.php`
