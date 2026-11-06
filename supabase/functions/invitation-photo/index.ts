import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const headers = { 'Cache-Control': 'no-store, no-cache, must-revalidate', Pragma: 'no-cache', Vary: 'Authorization' }
const fail = (status = 404) => new Response('Not found', { status, headers })

Deno.serve(async (request) => {
  if (request.method !== 'GET') return fail(405)
  const url = new URL(request.url)
  const username = url.searchParams.get('username')?.trim() || ''
  const publicKey = url.searchParams.get('key') || ''
  const photoId = url.searchParams.get('photo') || ''
  if (!username || !photoId || username.length > 40 || publicKey.length > 128 || photoId.length > 128) return fail()
  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  let projectQuery = service.from('projects').select('id,status,public_key').eq('username', username).eq('status', 'published')
  if (publicKey) projectQuery = projectQuery.eq('public_key', publicKey)
  const { data: project } = await projectQuery.maybeSingle()
  let storagePath = ''
  if (project) {
    const { data: photo } = await service.from('project_photos').select('storage_path').eq('id', photoId).eq('project_id', project.id).maybeSingle()
    storagePath = photo?.storage_path || ''
  } else {
    let guestQuery = service.from('guest_invitations').select('photos').eq('username', username).eq('status', 'published')
    if (publicKey) guestQuery = guestQuery.eq('public_key', publicKey)
    const { data: guest } = await guestQuery.maybeSingle()
    const photos = Array.isArray(guest?.photos) ? guest.photos : []
    const photo = photos.find((item: Record<string, unknown>) => item?.id === photoId)
    const candidate = typeof photo?.storage_path === 'string' ? photo.storage_path : ''
    if (/^[0-9a-f-]{36}$/.test(photoId) && new RegExp(`^guest-staging/[0-9a-f-]{36}/${photoId}\\.(jpg|png|webp)$`).test(candidate)) storagePath = candidate
  }
  if (!storagePath) return fail()
  const { data: object, error } = await service.storage.from('project-photos').download(storagePath)
  if (error || !object) return fail()
  return new Response(object, { status: 200, headers: { ...headers, 'Content-Type': object.type || 'application/octet-stream' } })
})
