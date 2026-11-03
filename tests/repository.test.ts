import { beforeEach, describe, expect, test } from 'bun:test'
import { emptyProject } from '../src/types'
import { repository, validateProjectInput, validateUploadFile, isSupabaseConfigured } from '../src/lib/repository'

describe('repository validation and local demo mode', () => {
  beforeEach(() => { try { localStorage.clear() } catch {} })
  test('exports explicit configuration state', () => expect(typeof isSupabaseConfigured).toBe('boolean'))
  const valid = { ...emptyProject, title: 'Demo', customer_name: 'Owner', person_a: 'A', person_b: 'B', event_date: '2026-12-01', event_time: '18:00', venue: 'Hall', username: 'demo-user' }
  test('rejects malformed project input', () => expect(() => validateProjectInput({ ...valid, message: '' })).toThrow())
  test('normalizes blank title and generates a valid username', () => {
    const input = { ...valid, title: '', username: '' }
    validateProjectInput(input)
    expect(input.title).toBe('')
    expect(() => validateProjectInput({ ...input, title: 'A & B', username: 'a-b' })).not.toThrow()
  })
  test('rejects invalid fields and duplicate usernames', async () => {
    expect(() => validateProjectInput({ ...valid, template: 'bad' as any })).toThrow()
    expect(() => validateProjectInput({ ...valid, map_url: 'http://example.com' })).toThrow()
    await repository.save(valid)
    await expect(repository.save({ ...valid, title: 'Other' })).rejects.toThrow('already in use')
  })
  test('rejects unsupported and oversized photos', () => {
    expect(() => validateUploadFile(new File(['x'], 'x.gif', { type: 'image/gif' }))).toThrow()
    expect(() => validateUploadFile(new File([new Uint8Array(4_490_001)], 'x.jpg', { type: 'image/jpeg' }))).toThrow()
    expect(() => validateUploadFile(new File([new Uint8Array(4_490_000)], 'x.jpg', { type: 'image/jpeg' }))).not.toThrow()
  })
  test('saves, publishes, hides customer details publicly, and revokes', async () => {
    const username = `test-${Date.now()}`
    const project = await repository.save({ ...valid, title: 'Demo', username, customer_name: 'Private Person', customer_email: 'private@example.com' })
    expect(project.status).toBe('draft')
    const photo = new File(['not-a-real-image'], 'photo.jpg', { type: 'image/jpeg' })
    await repository.upload(project.id, [photo])
    const published = await repository.publish(project.id)
    expect(published.public_key).toBeTruthy()
    const publicView = await repository.publicProject(username, published.public_key!)
    expect(publicView.customer_name).toBe('')
    expect(publicView.customer_email).toBe('')
    expect(publicView.public_key).toBeNull()
    expect(publicView.photos[0].url.startsWith('data:image/jpeg;base64,')).toBe(true)
    await repository.revoke(project.id)
    await expect(repository.publicProject(username, published.public_key!)).rejects.toThrow()
  })
  test('generated usernames are unique and maps/date/time validation is strict', async () => {
    const a = await repository.save({...valid,username:'',title:'',person_a:'မြန်မာ',person_b:'အမည်'})
    const b = await repository.save({...valid,username:'',title:'',person_a:'မြန်မာ',person_b:'အမည်'})
    expect(a.username).not.toBe(b.username)
    expect(a.username).toMatch(/^[a-z][a-z0-9-]{2,39}$/)
    expect(a.title).toBe('မြန်မာ & အမည်')
    expect(()=>validateProjectInput({...valid,event_date:'2027-02-30'})).toThrow()
    expect(()=>validateProjectInput({...valid,event_time:'29:00'})).toThrow()
    expect(()=>validateProjectInput({...valid,map_url:'https://maps.app.goo.gl/example'})).not.toThrow()
    expect(()=>validateProjectInput({...valid,map_url:'https://google.com.evil.test/maps'})).toThrow()
    expect(()=>validateProjectInput({...valid,project_type:'business'})).toThrow()
    expect(()=>validateProjectInput({...valid,message:'a'.repeat(351)})).toThrow()
  })
  test('publish requires photos and an upload batch cannot exceed eight', async () => {
    const p=await repository.save({...valid,username:`limit-${Date.now()}`})
    await expect(repository.publish(p.id)).rejects.toThrow()
    await expect(repository.upload(p.id,Array.from({length:9},()=>new File(['photo'],'photo.jpg',{type:'image/jpeg'})))).rejects.toThrow()
    expect((await repository.get(p.id)).photos).toHaveLength(0)
  })
  test('editing a published project invalidates its public link and photo mutations are rejected', async () => {
    const username = `edit-${Date.now()}`
    const project = await repository.save({ ...valid, username })
    await repository.upload(project.id, [new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })])
    const published = await repository.publish(project.id)
    const edited = await repository.save({ ...valid, username, title: 'Changed' }, project.id)
    expect(edited.status).toBe('draft'); expect(edited.public_key).toBeNull()
    const publishedAgain = await repository.publish(project.id)
    await expect(repository.upload(project.id, [new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })])).rejects.toThrow()
    await repository.revoke(project.id)
    expect(publishedAgain.public_key).toBeTruthy()
  })
  test('quota failures restore prior memory and throw', async () => {
    const project = await repository.save({ ...valid, username: `quota-${Date.now()}` })
    const hadStorage = 'localStorage' in globalThis
    const originalStorage = (globalThis as any).localStorage
    const fakeStorage = { setItem: () => { throw new Error('quota') }, getItem: () => null, clear: () => {} }
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: fakeStorage })
    try { await expect(repository.save({ ...valid, username: project.username, title: 'new' }, project.id)).rejects.toThrow(/quota/) } finally {
      if (hadStorage) Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalStorage })
      else delete (globalThis as any).localStorage
    }
    expect((await repository.get(project.id)).title).toBe(project.title)
  })
})
