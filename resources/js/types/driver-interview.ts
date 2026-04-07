export type CandidateInterest = 'baixo' | 'medio' | 'alto';

export type HrStatus =
    | 'aprovado'
    | 'reprovado'
    | 'em_analise'
    | 'aguardando_vaga'
    | 'guep'
    | 'teste_pratico';

export type GuepStatus =
    | 'nao_fazer'
    | 'a_fazer'
    | 'aprovado'
    | 'reprovado'
    | 'aguardando';

export type InterviewCurriculumStatus =
    | 'pendente'
    | 'recusado'
    | 'aguardando_entrevista'
    | 'aprovado_entrevista'
    | 'reprovado_entrevista';

export interface InterviewAuthor {
    id: number;
    name: string;
    email: string;
}

export interface InterviewUnit {
    id: number;
    nome: string;
    slug: string | null;
}

export interface InterviewCurriculumSummary {
    id: number;
    full_name: string;
    status: InterviewCurriculumStatus;
    document_original_name?: string;
    document_url?: string | null;
    cnh_attachment_original_name?: string | null;
    cnh_attachment_url?: string | null;
    work_card_attachment_original_name?: string | null;
    work_card_attachment_url?: string | null;
    has_cnh_attachment?: boolean;
    has_work_card_attachment?: boolean;
}

export interface DriverInterview {
    id: number;
    user_id: number | null;
    author_id: number | null;
    author: InterviewAuthor | null;
    full_name: string;
    preferred_name: string;
    birth_date: string | null;
    phone: string;
    email: string;
    city: string;
    cargo_pretendido: string | null;
    hiring_unidade_id: number | null;
    curriculum_id: number | null;
    hiring_unidade: InterviewUnit | null;
    curriculum: InterviewCurriculumSummary | null;
    marital_status: string;
    has_children: boolean;
    children_situation: string | null;
    cpf: string;
    rg: string;
    cnh_number: string;
    cnh_category: string;
    cnh_expiration_date: string;
    candidate_photo_path: string | null;
    candidate_photo_original_name: string | null;
    candidate_photo_url: string | null;
    cnh_attachment_path: string | null;
    cnh_attachment_original_name: string | null;
    cnh_attachment_url: string | null;
    work_card_attachment_path: string | null;
    work_card_attachment_original_name: string | null;
    work_card_attachment_url: string | null;
    ear: boolean;
    last_company: string;
    last_role: string;
    last_city: string;
    last_period_start: string;
    last_period_end: string;
    last_exit_type: string | null;
    last_exit_reason: string;
    last_company_observation: string | null;
    previous_company: string;
    previous_role: string;
    previous_city: string;
    previous_period_start: string;
    previous_period_end: string;
    previous_exit_type: string | null;
    previous_exit_reason: string;
    previous_company_observation: string | null;
    other_company: string | null;
    other_role: string | null;
    other_city: string | null;
    other_period_start: string | null;
    other_period_end: string | null;
    other_exit_reason: string | null;
    relevant_experience: string;
    truck_types_operated: string;
    night_shift_experience: boolean;
    live_animals_transport_experience: boolean;
    accident_history: boolean;
    accident_details: string | null;
    schedule_availability: string;
    start_availability_date: string;
    start_availability_note: string | null;
    knows_company_contact: boolean;
    contact_name: string | null;
    expectations_about_company: string;
    last_salary: number;
    salary_expectation: number;
    salary_observation: string | null;
    posture_communication: string;
    perceived_experience: string;
    general_observations: string | null;
    candidate_interest: CandidateInterest;
    availability_matches: boolean;
    overall_score: number;
    hr_status: HrStatus;
    hr_rejection_reason: string | null;
    guep_status: GuepStatus;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}

export interface DriverInterviewListItem {
    id: number;
    author_id: number | null;
    full_name: string;
    author: InterviewAuthor | null;
    hiring_unidade: InterviewUnit | null;
    hr_status: HrStatus;
    hr_rejection_reason: string | null;
    guep_status: GuepStatus;
    has_candidate_photo: boolean;
    has_cnh_attachment: boolean;
    has_work_card_attachment: boolean;
    has_curriculum: boolean;
    curriculum: InterviewCurriculumSummary | null;
    created_at: string;
}

export interface InterviewCurriculumListItem {
    id: number;
    author_id: number | null;
    author: InterviewAuthor | null;
    full_name: string;
    phone: string | null;
    role_name: string | null;
    unit_name: string | null;
    observacao: string | null;
    status: InterviewCurriculumStatus;
    document_original_name: string;
    document_url: string | null;
    cnh_attachment_original_name: string | null;
    cnh_attachment_url: string | null;
    work_card_attachment_original_name: string | null;
    work_card_attachment_url: string | null;
    has_cnh_attachment: boolean;
    has_work_card_attachment: boolean;
    attachments_status: '-' | 'CNH' | 'CT' | 'CNH/CT';
    linked_interview: {
        id: number;
        full_name: string;
        hr_status: HrStatus;
        foi_contratado: boolean;
    } | null;
    created_at: string;
    updated_at: string;
}

export interface NextStepDocumentLinks {
    preview_url: string;
    pdf_url: string;
    download_url: string;
}

export interface NextStepCandidate {
    id: number;
    full_name: string;
    preferred_name: string;
    cpf: string;
    rg: string;
    cnh_number: string;
    cnh_expiration_date: string;
    email: string;
    phone: string;
    cargo_pretendido: string | null;
    hiring_unidade_id: number | null;
    start_availability_date: string;
    marital_status: string;
    hr_status: HrStatus;
    foi_contratado: boolean;
    colaborador_id: number | null;
    onboarding_id: number | null;
    onboarding_status: 'em_andamento' | 'bloqueado' | 'concluido' | null;
    created_at: string;
    documents: {
        checklist: NextStepDocumentLinks;
        'raca-etnia': NextStepDocumentLinks;
    };
}

export interface OnboardingItemAttachment {
    id: number;
    original_name: string;
    mime: string;
    size: number;
    uploaded_by: number | null;
    uploaded_by_name: string | null;
    created_at: string;
    download_url: string;
}

export interface OnboardingItem {
    id: number;
    onboarding_id: number;
    code: string;
    title: string;
    required: boolean;
    status: 'pendente' | 'em_analise' | 'aprovado' | 'reprovado';
    due_date: string | null;
    approved_by: number | null;
    approved_by_name: string | null;
    approved_at: string | null;
    notes: string | null;
    attachments: OnboardingItemAttachment[];
    created_at: string;
    updated_at: string;
}

export interface OnboardingEvent {
    id: number;
    event_type: string;
    from_value: string | null;
    to_value: string | null;
    payload: Record<string, unknown> | null;
    performed_by: number | null;
    performed_by_name: string | null;
    onboarding_item_id: number | null;
    created_at: string;
}

export interface OnboardingRecord {
    id: number;
    driver_interview_id: number;
    colaborador_id: number | null;
    responsavel_user_id: number | null;
    responsavel_name: string | null;
    status: 'em_andamento' | 'bloqueado' | 'concluido';
    started_at: string | null;
    concluded_at: string | null;
    required_total: number;
    required_approved: number;
    overdue_count: number;
    interview: {
        id: number;
        full_name: string;
        author_id: number;
    } | null;
    colaborador: {
        id: number;
        nome: string;
        unidade_id: number;
        unidade_nome: string | null;
    } | null;
    items: OnboardingItem[];
    events: OnboardingEvent[];
    created_at: string;
    updated_at: string;
}

export interface OnboardingSummary {
    total: number;
    em_andamento: number;
    bloqueado: number;
    concluido: number;
    atrasados: number;
    vencem_hoje: number;
    vencem_3_dias: number;
}

export interface DriverInterviewFormData {
    full_name: string;
    preferred_name: string;
    birth_date: string;
    phone: string;
    email: string;
    city: string;
    cargo_pretendido: string;
    hiring_unidade_id: string;
    curriculum_id: string;
    marital_status: string;
    has_children: boolean;
    children_situation: string;
    cpf: string;
    rg: string;
    cnh_number: string;
    cnh_category: string;
    cnh_expiration_date: string;
    ear: boolean;
    last_company: string;
    last_role: string;
    last_city: string;
    last_period_start: string;
    last_period_end: string;
    last_exit_type: string;
    last_exit_reason: string;
    last_company_observation: string;
    previous_company: string;
    previous_role: string;
    previous_city: string;
    previous_period_start: string;
    previous_period_end: string;
    previous_exit_type: string;
    previous_exit_reason: string;
    previous_company_observation: string;
    other_company: string;
    other_role: string;
    other_city: string;
    other_period_start: string;
    other_period_end: string;
    other_exit_reason: string;
    relevant_experience: string;
    truck_types_operated: string;
    night_shift_experience: boolean;
    live_animals_transport_experience: boolean;
    accident_history: boolean;
    accident_details: string;
    schedule_availability: string;
    start_availability_date: string;
    start_availability_note: string;
    knows_company_contact: boolean;
    contact_name: string;
    expectations_about_company: string;
    last_salary: string;
    salary_expectation: string;
    salary_observation: string;
    posture_communication: string;
    perceived_experience: string;
    general_observations: string;
    candidate_interest: CandidateInterest;
    availability_matches: boolean;
    overall_score: string;
    hr_status: HrStatus;
    hr_rejection_reason: string;
    guep_status: GuepStatus;
}

export interface ApiPaginationMeta {
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
}

export interface ApiPaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

export interface ApiPaginatedResponse<T> {
    data: T[];
    links: ApiPaginationLink[];
    meta: ApiPaginationMeta;
}

export interface DashboardSummary {
    total_interviews: number;
    total_approved: number;
    total_reproved: number;
    total_waiting_vacancy: number;
    total_practical_test: number;
    pending_actions: {
        waiting_vacancy: number;
        practical_test: number;
        guep_to_do: number;
        total: number;
    };
    recent_interviews: Array<{
        id: number;
        full_name: string;
        city: string;
        hr_status: HrStatus;
        guep_status: GuepStatus;
        created_at: string;
        author_name: string | null;
    }>;
    recent_activity: Array<{
        id: number;
        full_name: string;
        event: string;
        at: string;
    }>;
}

export interface ApiValidationErrors {
    [key: string]: string[];
}
