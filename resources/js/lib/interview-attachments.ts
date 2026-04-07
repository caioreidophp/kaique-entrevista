import { apiPost } from '@/lib/api-client';

export interface InterviewAttachmentPayload {
    candidate_photo_file?: File | null;
    cnh_attachment_file?: File | null;
    work_card_attachment_file?: File | null;
    remove_candidate_photo?: boolean;
    remove_cnh_attachment?: boolean;
    remove_work_card_attachment?: boolean;
}

const ATTACHMENT_KEYS = new Set<string>([
    'candidate_photo_file',
    'cnh_attachment_file',
    'work_card_attachment_file',
    'remove_candidate_photo',
    'remove_cnh_attachment',
    'remove_work_card_attachment',
]);

function toOptionalFile(value: unknown): File | null {
    return typeof File !== 'undefined' && value instanceof File ? value : null;
}

function toOptionalBoolean(value: unknown): boolean {
    return value === true;
}

export function splitInterviewPayload(payload: Record<string, unknown>): {
    data: Record<string, unknown>;
    attachments: InterviewAttachmentPayload;
} {
    const data = Object.fromEntries(
        Object.entries(payload).filter(([key]) => !ATTACHMENT_KEYS.has(key)),
    );

    const attachments: InterviewAttachmentPayload = {
        candidate_photo_file: toOptionalFile(payload.candidate_photo_file),
        cnh_attachment_file: toOptionalFile(payload.cnh_attachment_file),
        work_card_attachment_file: toOptionalFile(payload.work_card_attachment_file),
        remove_candidate_photo: toOptionalBoolean(payload.remove_candidate_photo),
        remove_cnh_attachment: toOptionalBoolean(payload.remove_cnh_attachment),
        remove_work_card_attachment: toOptionalBoolean(payload.remove_work_card_attachment),
    };

    return { data, attachments };
}

export async function syncInterviewAttachments(
    interviewId: number,
    attachments: InterviewAttachmentPayload,
): Promise<void> {
    const formData = new FormData();
    let hasChanges = false;

    if (attachments.candidate_photo_file) {
        formData.append('candidate_photo_file', attachments.candidate_photo_file);
        hasChanges = true;
    }

    if (attachments.cnh_attachment_file) {
        formData.append('cnh_attachment_file', attachments.cnh_attachment_file);
        hasChanges = true;
    }

    if (attachments.work_card_attachment_file) {
        formData.append('work_card_attachment_file', attachments.work_card_attachment_file);
        hasChanges = true;
    }

    if (attachments.remove_candidate_photo) {
        formData.append('remove_candidate_photo', '1');
        hasChanges = true;
    }

    if (attachments.remove_cnh_attachment) {
        formData.append('remove_cnh_attachment', '1');
        hasChanges = true;
    }

    if (attachments.remove_work_card_attachment) {
        formData.append('remove_work_card_attachment', '1');
        hasChanges = true;
    }

    if (!hasChanges) {
        return;
    }

    await apiPost(`/driver-interviews/${interviewId}/attachments`, formData);
}
