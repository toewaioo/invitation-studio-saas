#!/usr/bin/env node
/**
 * Production-only QA verification for guest creation and public schedule reads.
 *
 * This script intentionally creates one synthetic guest invitation. It never
 * authenticates, lists, updates, or deletes existing customer projects.
 * Do not run casually; run only as an explicitly authorized verification.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const configuredEndpoint = process.env.API_ORIGIN || process.argv[2]
const endpoint = configuredEndpoint || 'https://love-birds-mm.vercel.app/api/studio'
const artifactPath = resolve(process.env.ARTIFACT_PATH || 'artifacts/schedule/production-verification.json')

function fail(message) {
  throw new Error(message)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

async function readJson(response, label) {
  const text = await response.text()
  let value
  try {
    value = JSON.parse(text)
  } catch {
    fail(`${label} returned non-JSON HTTP ${response.status}`)
  }
  if (!response.ok) {
    const safeError = typeof value?.error === 'string' ? value.error : 'request failed'
    fail(`${label} returned HTTP ${response.status}: ${safeError}`)
  }
  return value
}

function futureDate() {
  const date = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
  return date.toISOString().slice(0, 10)
}

// A deterministic 1x1 transparent PNG, generated locally; no file upload or
// external asset is needed. The guest API accepts image data URLs.
const tinyPngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

const expectedSchedule = [
  { time: '07:00', label: 'QA TEST milestone 07:00' },
  { time: '08:00', label: 'QA TEST milestone 08:00' },
  { time: '09:00', label: 'QA TEST milestone 09:00' },
  { time: '10:00', label: 'QA TEST milestone 10:00' },
]

async function main() {
  const api = new URL(endpoint)
  assert(api.protocol === 'https:', 'API_ORIGIN must use HTTPS for production verification')
  const requestUrl = new URL(api)
  requestUrl.searchParams.set('action', 'guest')
  const apiOrigin = api.origin
  const eventDate = futureDate()

  const input = {
    title: 'QA TEST — Synthetic Canary Invitation',
    person_a: 'QA TEST Alice Synthetic',
    person_b: 'QA TEST Bob Synthetic',
    parent_a: 'QA TEST Parent A',
    parent_b: 'QA TEST Parent B',
    event_date: eventDate,
    event_time: '09:37',
    venue: 'QA TEST Synthetic Venue',
    message: 'QA TEST invitation — synthetic production verification only.',
    map_url: '',
    template: 'rose',
    theme: 'rose',
    project_type: 'wedding',
    schedule: expectedSchedule,
  }

  // The Origin header must match the API origin because api/studio.ts checks it
  // for non-GET requests. No cookies, auth headers, or service credentials are sent.
  const createdResponse = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: apiOrigin,
    },
    body: JSON.stringify({ input, photos: [{ dataUrl: tinyPngDataUrl, caption: 'QA TEST local canary image' }] }),
  })
  const createdBody = await readJson(createdResponse, 'guest creation')
  const created = createdBody?.data
  assert(created && typeof created === 'object', 'guest creation response did not contain data')
  assert(created.status === 'published', 'guest creation did not return a published invitation')
  assert(typeof created.id === 'string' && created.id.length > 0, 'guest creation response did not contain an id')
  assert(typeof created.username === 'string' && created.username.length > 0, 'guest creation response did not contain a username')
  assert(typeof created.public_key === 'string' && created.public_key.length > 0, 'guest creation response did not contain a public key')

  const publicUrl = new URL(api)
  publicUrl.searchParams.set('action', 'publicProject')
  publicUrl.searchParams.set('username', created.username)
  publicUrl.searchParams.set('key', created.public_key)
  const publicResponse = await fetch(publicUrl)
  const publicBody = await readJson(publicResponse, 'public project read')
  const project = publicBody?.data
  assert(project && typeof project === 'object', 'public project response did not contain data')
  assert(project.id === created.id, 'public project id did not match created id')
  assert(project.username === created.username, 'public project username did not match created username')
  assert(project.event_time === '09:37', 'canary event_time was not preserved')
  assert(project.event_date === eventDate, 'future event_date was not preserved')
  assert(JSON.stringify(project.schedule) === JSON.stringify(expectedSchedule), 'public schedule did not exactly match the four custom milestones')
  for (const field of ['customer_name', 'customer_email', 'customer_phone', 'private_notes']) {
    assert(project[field] === '', `public project exposed private field ${field}`)
  }
  assert(project.public_key === null, 'public project exposed its public key field')
  assert(Array.isArray(project.photos) && project.photos.length === 1, 'public project did not return the one QA image')
  assert(project.photos[0]?.url === tinyPngDataUrl, 'public project did not preserve the local image data URL')

  const artifact = {
    verification: 'QA TEST production guest creation/public read',
    created_at: new Date().toISOString(),
    id: created.id,
    username: created.username,
    key: created.public_key,
    public_url: publicUrl.toString(),
    checks: {
      status_published: true,
      synthetic_future_date: eventDate,
      canary_event_time_0937_preserved: true,
      exact_schedule: expectedSchedule,
      private_fields_empty: ['customer_name', 'customer_email', 'customer_phone', 'private_notes'],
      public_key_hidden: true,
      one_local_png_data_url_returned: true,
    },
  }
  await mkdir(dirname(artifactPath), { recursive: true })
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
  console.log(`Production schedule verification passed; artifact written to ${artifactPath}`)
  console.log(`Created synthetic invitation id=${created.id} username=${created.username}`)
}

main().catch((error) => {
  // Never print request bodies, cookies, auth headers, or public keys.
  console.error(`Production schedule verification failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  process.exitCode = 1
})
