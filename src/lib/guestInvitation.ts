import type { Project, ProjectInput } from '../types';
import { apiRequest } from './api';
import { normalizeProjectInput, isSupabaseConfigured, validateUploadResolution } from './repository';
import { MAX_PHOTO_BYTES } from './validation';
import { normalizeGuestPhotoMime } from './photoMime';

export const GUEST_MAX_PHOTOS = 3;
export const GUEST_PHOTO_BYTES = MAX_PHOTO_BYTES;
export const publicInputFields = ['title', 'person_a', 'person_b', 'parent_a', 'parent_b', 'event_date', 'event_time', 'venue', 'message', 'map_url', 'template', 'theme', 'project_type', 'schedule'] as const;
export function guestPublicInput(input: ProjectInput) {
  // Validate using a transient name, but never transmit customer/contact/private fields.
  const validated = normalizeProjectInput({ ...input, customer_name: 'Guest', customer_email: '', customer_phone: '', private_notes: '', username: '' });
  return Object.fromEntries(publicInputFields.filter(field => validated[field] !== undefined).map(field => [field, validated[field]]));
}

type UploadStart = {
  sessionId: string;
  sessionToken: string;
  expiresAt: string;
  uploads: Array<{ photoId: string; contentType: string; size: number }>;
};

export async function createGuestInvitation(input: ProjectInput, files: File[]): Promise<Project> {
  if (!isSupabaseConfigured) throw new Error('Public publishing is not configured yet. No share link was created. / အများကြည့်ဖိတ်စာ ထုတ်ပေးမှု မချိတ်ဆက်ရသေးပါ။');
  const publicInput = guestPublicInput(input);
  if (!files.length || files.length > GUEST_MAX_PHOTOS) throw new Error('Choose 1–3 photos / ဓာတ်ပုံ ၁ ပုံမှ ၃ ပုံ ရွေးပါ။');
  const uploadFiles = await Promise.all(files.map(normalizeGuestPhotoMime));
  for (const file of uploadFiles) await validateUploadResolution(file);

  const session = await apiRequest<UploadStart>('guestUploadStart', {
    body: { input: publicInput, photos: uploadFiles.map(file => ({ size: file.size, type: file.type.toLowerCase() })) },
  });
  if (!session?.sessionId || !session.sessionToken || session.uploads?.length !== uploadFiles.length) throw new Error('Upload authorization could not be confirmed. / ဓာတ်ပုံတင်ရန် ခွင့်ပြုချက်ကို အတည်မပြုနိုင်ပါ။');

  try {
    for (let index = 0; index < uploadFiles.length; index++) {
      const file = uploadFiles[index];
      const upload = session.uploads[index];
      if (!upload?.photoId || upload.contentType !== file.type.toLowerCase() || upload.size !== file.size) throw new Error('Upload authorization did not match the selected photo. / ဓာတ်ပုံအချက်အလက် မကိုက်ညီပါ။');
      await apiRequest<{ uploaded: boolean }>('guestUploadFile', {
        raw: file,
        headers: {
          'x-guest-session-id': session.sessionId,
          'x-guest-session-token': session.sessionToken,
          'x-guest-photo-id': upload.photoId,
        },
      });
    }
    const project = await apiRequest<Project>('guestUploadFinalize', {
      body: { sessionId: session.sessionId, sessionToken: session.sessionToken },
    });
    if (!project?.public_key || project.status !== 'published') throw new Error('Publishing could not be confirmed. Please do not repeatedly submit; the service may not be enabled yet. / မျှဝေမှုကို အတည်မပြုနိုင်ပါ။ ထပ်ခါတလဲလဲ မတင်ပါနှင့်။');
    return project;
  } catch (error) {
    // Cancellation cannot unpublish a successful commit; the server only removes objects for pending sessions.
    await apiRequest<{ canceled: boolean }>('guestUploadCancel', {
      body: { sessionId: session.sessionId, sessionToken: session.sessionToken },
    }).catch(() => undefined);
    throw error;
  }
}
