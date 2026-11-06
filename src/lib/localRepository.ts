import type { Project, ProjectInput, StudioRepository } from '../types'
import { normalizeProjectInput, slugify, usernamePattern, validateUploadResolution } from './validation'

const memory = new Map<string, Project>()
const localKey = 'invitation-studio.projects.v1'
const now = () => new Date().toISOString()
const makeId = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
const makeKey = () => `${makeId().replaceAll('-', '')}${makeId().replaceAll('-', '')}`
const clone = <T>(v: T): T => typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v))
const fileDataUrl = async (file: File): Promise<string> => { if (typeof FileReader !== 'undefined') return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error || new Error('Could not read photo')); r.readAsDataURL(file) }); const bytes = new Uint8Array(await file.arrayBuffer()); let binary = ''; for (const b of bytes) binary += String.fromCharCode(b); return `data:${file.type};base64,${typeof btoa === 'function' ? btoa(binary) : (globalThis as any).Buffer.from(bytes).toString('base64')}` }
function readLocal(): void { try { const raw = localStorage.getItem(localKey); if (!raw) return; const parsed = JSON.parse(raw) as Project[]; if (!Array.isArray(parsed)) throw new Error('Invalid local data'); memory.clear(); parsed.forEach(p => memory.set(p.id, p)) } catch { /* Keep in-memory data intact when storage is unavailable/corrupt. */ } }
function writeLocal(previous: Map<string, Project>): void { if (typeof localStorage === 'undefined') return; try { localStorage.setItem(localKey, JSON.stringify([...memory.values()])) } catch (error) { memory.clear(); previous.forEach((p, id) => memory.set(id, p)); const e = new Error('Could not save: local storage quota exceeded or unavailable'); (e as any).cause = error; throw e } }
const getLocal = () => { readLocal(); return memory }

class LocalRepository implements StudioRepository {
  async list(): Promise<Project[]> { return [...getLocal().values()].sort((a,b) => b.updated_at.localeCompare(a.updated_at)).map(clone) }
  async get(id: string): Promise<Project> { const p = getLocal().get(id); if (!p) throw new Error('Project not found'); return clone(p) }
  async save(raw: ProjectInput, id?: string): Promise<Project> {
    const input = normalizeProjectInput(raw), old = id ? await this.get(id) : undefined;
    if (!await this.usernameAvailable(input.username, id)) throw new Error('Username is already in use');
    const previous = new Map(memory);
    const p: Project = { ...input, id: id || makeId(), status: 'draft', photos: old?.photos || [], created_at: old?.created_at || now(), updated_at: now(), public_key: null };
    getLocal().set(p.id, p); writeLocal(previous); return clone(p);
  }
  async upload(id: string, files: File[]): Promise<Project> {
    const p = await this.get(id);
    if (p.status === 'published') throw new Error('Published invitations must be revoked before changing photos');
    if (files.length + p.photos.length > 8) throw new Error('A project may contain at most 8 photos');
    for (const file of files) await validateUploadResolution(file);
    const previous = new Map(memory), used = new Set(p.photos.map(x => x.position));
    for (const file of files) { let position = 0; while (used.has(position)) position++; used.add(position); p.photos.push({ id: makeId(), url: await fileDataUrl(file), caption: '', position }); }
    p.updated_at = now(); memory.set(p.id, p); writeLocal(previous); return clone(p);
  }
  async removePhoto(id: string, photoId: string): Promise<Project> {
    const p = await this.get(id);
    if (p.status === 'published') throw new Error('Published invitations must be revoked before changing photos');
    if (!p.photos.some(x => x.id === photoId)) throw new Error('Photo not found');
    const previous = new Map(memory); p.photos = p.photos.filter(x => x.id !== photoId); p.updated_at = now(); memory.set(id, p); writeLocal(previous); return p;
  }
  async publish(id: string): Promise<Project> {
    const p = await this.get(id); if (!p.photos.length) throw new Error('Add at least one photo before publishing');
    const previous = new Map(memory); p.status = 'published'; p.public_key = makeKey(); p.updated_at = now(); memory.set(id, p); writeLocal(previous); return p;
  }
  async revoke(id: string): Promise<Project> {
    const p = await this.get(id), previous = new Map(memory); p.status = 'draft'; p.public_key = null; p.updated_at = now(); memory.set(id, p); writeLocal(previous); return p;
  }
  async publicProject(username: string, key?: string): Promise<Project> {
    if (!username) throw new Error('Invalid invitation link');
    const p = [...getLocal().values()].find(x => x.username === username && x.status === 'published' && (!key || x.public_key === key));
    if (!p) throw new Error('Invitation not found or revoked');
    return { ...clone(p), customer_name: '', customer_email: '', customer_phone: '', private_notes: '', public_key: null };
  }
  async usernameAvailable(username: string, exceptId?: string): Promise<boolean> { const normalized = slugify(username); return usernamePattern.test(normalized) && ![...getLocal().values()].some(x => x.username.toLowerCase() === normalized && x.id !== exceptId) }
}
export const localRepository = new LocalRepository();
