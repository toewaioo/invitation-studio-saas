import type { ProjectInput } from '../types.js'
import { normalizeSchedule } from './schedule.js'

export const fields = ['title','customer_name','customer_email','customer_phone','private_notes','person_a','person_b','parent_a','parent_b','event_date','event_time','venue','message','map_url','username','template','theme','project_type'] as const
const makeId = () => globalThis.crypto.randomUUID()
export const slugify = (value: string): string => value.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
export const usernamePattern = /^[a-z][a-z0-9-]{2,39}$/
const designs = new Set(['thazin','noir','rose']), themes = new Set(['sage','midnight','rose','blue']), projectTypes = new Set(['wedding','celebration','business'])

function normalizedInput(input: ProjectInput): ProjectInput {
  if (!input) throw new Error('Project details are required')
  const value = { ...input } as ProjectInput
  for (const f of fields) if (typeof value[f] === 'string') (value as any)[f] = value[f].trim()
  if (value.schedule !== undefined) value.schedule = normalizeSchedule(value.schedule)
  if (!value.title) value.title = `${value.person_a} & ${value.person_b}`.trim() || 'Invitation'
  if (!value.username) { let base = slugify(value.title) || 'invitation'; if (!/^[a-z]/.test(base)) base = 'invitation'; value.username = `${base.slice(0,28)}-${makeId().replaceAll('-','').slice(0,8)}` }
  value.username = value.username.trim().toLowerCase()
  return value
}

export function validateProjectInput(input: ProjectInput): void {
  const value = normalizedInput(input)
  if (!value.title) throw new Error('A project title is required')
  if (!usernamePattern.test(value.username)) throw new Error('Username must start with a letter and contain 3–40 lowercase letters, numbers, or hyphens')
  const required: Array<[keyof ProjectInput, string]> = [['customer_name','Customer name'],['person_a','First person'],['person_b','Second person'],['event_date','Event date'],['event_time','Event time'],['venue','Venue'],['message','Message']]
  for (const [field, label] of required) if (!String(value[field] || '').trim()) throw new Error(`${label} is required`)
  if (value.title.length > 120) throw new Error('Project title is too long')
  if (value.username.length > 40) throw new Error('Username is too long')
  const limits = {customer_name:100,customer_email:160,customer_phone:50,private_notes:1500,person_a:60,person_b:60,parent_a:180,parent_b:180,venue:220,message:350,map_url:1200} as const
  for (const f of Object.keys(limits) as Array<keyof typeof limits>) if (value[f].length > limits[f]) throw new Error(`${f} is too long`)
  const day = new Date(`${value.event_date}T12:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.event_date) || Number.isNaN(day.getTime()) || day.toISOString().slice(0,10) !== value.event_date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.event_time)) throw new Error('Enter a valid event date and time')
  if (value.customer_email && !/^\S+@\S+\.\S+$/.test(value.customer_email)) throw new Error('Enter a valid customer email')
  if (value.map_url) {
    let url: URL
    try { url = new URL(value.map_url) } catch { throw new Error('Map link must be a valid HTTPS Google Maps URL') }
    const host = url.hostname.toLowerCase()
    if (url.protocol !== 'https:' || !['www.google.com','maps.google.com','maps.app.goo.gl','goo.gl'].includes(host)) throw new Error('Map link must be a valid HTTPS Google Maps URL')
  }
  if (!designs.has(value.template)) throw new Error('Invalid design')
  if (!themes.has(value.theme)) throw new Error('Invalid theme')
  if (!projectTypes.has(value.project_type) || value.project_type !== 'wedding') throw new Error('This project type is not available yet')
}

export function normalizeProjectInput(input: ProjectInput): ProjectInput { const value = normalizedInput(input); validateProjectInput(value); return value }

export const MAX_PHOTO_BYTES = 4_490_000;

export function validateUploadFile(file: File): void {
  const allowed = ['image/jpeg','image/png','image/webp']
  if (!allowed.includes(file.type.toLowerCase())) throw new Error(`${file.name || 'Photo'} must be JPG, PNG, or WEBP`)
  if (file.size > MAX_PHOTO_BYTES) throw new Error(`${file.name || 'Photo'} is larger than 4.49 MB`)
}
export async function validateUploadResolution(file: File): Promise<void> { validateUploadFile(file); if (typeof createImageBitmap === 'function') { const image = await createImageBitmap(file); try { if (image.width * image.height > 25_000_000) throw new Error(`${file.name || 'Photo'} exceeds 25 megapixels`) } finally { image.close() } } }
