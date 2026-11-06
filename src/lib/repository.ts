import type { Project, ProjectInput, StudioRepository } from '../types'
import { apiRequest } from './api'
import { localRepository } from './localRepository'
import { normalizeProjectInput, validateUploadResolution } from './validation'
export { normalizeProjectInput, validateProjectInput, validateUploadFile, validateUploadResolution } from './validation'
export type { StudioRepository } from '../types'

// Deployed builds always use the server, and fail closed if its configuration is missing.
// Local browser-only demo is opt-in; it is never an automatic cloud-error fallback.
const localDemo = import.meta.env?.VITE_LOCAL_DEMO === 'true' || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test');
export const isSupabaseConfigured = !localDemo;

export class ServerRepository implements StudioRepository {
  list() { return apiRequest<Project[]>('list') }
  get(projectId: string) { return apiRequest<Project>('get', { query: { projectId } }) }
  save(input: ProjectInput, projectId?: string) { return apiRequest<Project>('save', { body: { input: normalizeProjectInput(input), projectId } }) }
  async upload(projectId: string, files: File[]) {
    // Binary requests keep base64 overhead out of the gateway. Vercel still caps inbound function bodies at 4.5 MiB; production uploads above that need an approved chunked/signed-upload path.
    const original = await this.get(projectId);
    if (original.status === 'published') throw new Error('Published invitations must be revoked before changing photos');
    if (original.photos.length + files.length > 8) throw new Error('A project may contain at most 8 photos');
    for (const file of files) await validateUploadResolution(file);
    let project = original;
    const added: string[] = [];
    try {
      for (const file of files) {
        const next = await apiRequest<Project>('upload', { query: { projectId }, raw: file });
        for (const photo of next.photos) if (!project.photos.some(p => p.id === photo.id)) added.push(photo.id);
        project = next;
      }
      return project;
    } catch (error) {
      // Best-effort compensation for confirmed uploads, never retry an uncertain upload.
      for (const photoId of added) await this.removePhoto(projectId, photoId).catch(() => undefined);
      throw error;
    }
  }
  removePhoto(projectId: string, photoId: string) { return apiRequest<Project>('removePhoto', { body: { projectId, photoId } }) }
  publish(projectId: string) { return apiRequest<Project>('publish', { body: { projectId } }) }
  revoke(projectId: string) { return apiRequest<Project>('revoke', { body: { projectId } }) }
  async deleteProject(projectId: string, confirmUsername: string) { await apiRequest('deleteProject', { body: { projectId, confirmUsername } }) }
  publicProject(username: string, key?: string) { return apiRequest<Project>('publicProject', { query: { username, ...(key ? { key } : {}) } }) }
  usernameAvailable(username: string, exceptId?: string) { return apiRequest<boolean>('usernameAvailable', { query: { username, exceptId } }) }
}
export const repository: StudioRepository = localDemo ? localRepository : new ServerRepository();
export default repository;
