# Roadmap Técnico - App Mobile de Motoristas (baseado no sistema atual)

## Objetivo
Criar um app para motoristas integrado ao backend Laravel atual, enviando dados operacionais para o painel web do Master Admin.

## Casos de uso prioritários (MVP)
1. Login do motorista (token Sanctum dedicado ao app).
2. Checklist pré-viagem do caminhão (itens obrigatórios + fotos opcionais).
3. Informar viagem iniciada/finalizada e previsão de chegada na JBS.
4. Enviar ocorrências (atraso, manutenção, problema de rota).
5. Painel web consolidado com status em tempo real por motorista/viagem.

## O que já ajuda no projeto atual
- Autenticação via Sanctum já existe e pode ser reaproveitada.
- Estrutura de módulos operacionais já está organizada (Fretes, Cadastro, Logs).
- Activity Log já disponível para trilha de auditoria.
- Cadastro de placas, aviários, colaboradores e unidades já implementado.

## Preparação de backend recomendada (próxima fase)
1. Criar domínio "mobile"
   - `mobile_users` (ou usar `users` + role `motorista`)
   - `mobile_sessions` (opcional para controle de dispositivo)
2. Criar tabelas operacionais
   - `driver_trips` (motorista, placa, unidade, status, horários)
   - `driver_checklists` (viagem, respostas por item, observações)
   - `driver_checklist_attachments` (fotos do checklist)
   - `driver_occurrences` (tipo, severidade, descrição, timestamp)
3. Endpoints API dedicados
   - `POST /api/mobile/login`
   - `GET /api/mobile/me`
   - `POST /api/mobile/trips/start`
   - `POST /api/mobile/trips/{trip}/checklist`
   - `PATCH /api/mobile/trips/{trip}/eta`
   - `POST /api/mobile/trips/{trip}/occurrences`
   - `POST /api/mobile/trips/{trip}/finish`
4. Segurança
   - throttle específico por rota mobile
   - policy por motorista (cada um só acessa suas viagens)
   - validação forte de payload + upload

## Preparação de frontend web (admin)
1. Novo card na Home: "Operação de Motoristas".
2. Página de monitoramento com:
   - viagens em andamento
   - ETA por motorista
   - checklist pendente/concluído
   - alertas de ocorrência
3. Filtros por unidade, motorista e status.

## Stack sugerida para app mobile
- React Native + Expo (velocidade de entrega)
- Persistência local para modo offline leve (fila de sync)
- Upload de mídia com compressão antes do envio

## Estratégia de rollout
1. MVP interno com 3-5 motoristas.
2. Coleta de feedback por 2 semanas.
3. Ajustes de UX/checklist.
4. Escalar para toda operação.

## Critérios de pronto do MVP
- Motorista consegue iniciar e finalizar viagem sem suporte manual.
- Checklist obrigatório antes de iniciar viagem.
- Master Admin acompanha status e ETA no painel web.
- Eventos críticos registrados no log.
