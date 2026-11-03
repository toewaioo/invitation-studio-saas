import { expect, test } from 'bun:test';
import { LOVE_GALAXY_PHOTO_COUNT, normalizeLoveGalaxyInput, publishedLoveGalaxyUrl } from '../src/lib/loveGalaxy';

const input = { title:'Our Universe', ring_text_one:'ပထမစာသားကွင်း', ring_text_two:'Second orbit phrase', music_track:'cosmic-orbit' as const };

test('Love Galaxy input trims text, validates fields, and defaults journey consent to off', () => {
  expect(LOVE_GALAXY_PHOTO_COUNT).toBe(4);
  expect(normalizeLoveGalaxyInput({ ...input, title:'  Our Universe  ', ring_text_one:'  Memories are ours  ' })).toEqual({
    title:'Our Universe', ring_text_one:'Memories are ours', ring_text_two:'Second orbit phrase', music_track:'cosmic-orbit', journey_discovery_enabled:false,
  });
  expect(normalizeLoveGalaxyInput({ ...input, journey_discovery_enabled:true }).journey_discovery_enabled).toBe(true);
  expect(() => normalizeLoveGalaxyInput({ ...input, ring_text_one:'x'.repeat(65) })).toThrow('64 characters or fewer');
  expect(() => normalizeLoveGalaxyInput({ ...input, music_track:'external-url' as never })).toThrow('Choose a supported music option');
});

test('published Love Galaxy URL is a separate /love/ link and carries only the opaque share key', () => {
  const url = publishedLoveGalaxyUrl({ status:'published', username:'galaxy-0123456789abcdef', public_key:'a'.repeat(64) },'https://love.example');
  expect(url).toBe(`https://love.example/love/galaxy-0123456789abcdef?key=${'a'.repeat(64)}`);
  expect(url).not.toContain('/i/');
  expect(publishedLoveGalaxyUrl({ status:'published', username:'galaxy-0123456789abcdef', public_key:null },'https://love.example')).toBeNull();
  expect(publishedLoveGalaxyUrl({ status:'draft' as 'published', username:'galaxy-0123456789abcdef', public_key:'a'.repeat(64) },'https://love.example')).toBeNull();
});
