import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, LockKeyhole } from 'lucide-react';
import LoveGalaxyExperience from './LoveGalaxyExperience';
import { fetchPublicLoveGalaxy, type LoveGalaxy } from '../lib/loveGalaxy';
import './love-galaxy-create.css';

export default function LoveGalaxyPublic() {
  const [galaxy, setGalaxy] = useState<LoveGalaxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    const username = decodeURIComponent(location.pathname.replace(/^\/love\//, '').replace(/\/+$/, ''));
    const key = new URLSearchParams(location.search).get('key') || '';
    if (!/^galaxy-[a-z0-9-]{8,39}$/.test(username) || !key) {
      setUnavailable(true); setLoading(false); return;
    }
    fetchPublicLoveGalaxy(username, key)
      .then(value => {
        if (value.status !== 'published' || !Array.isArray(value.photos) || value.photos.length !== 4) {
          throw new Error('This Love Galaxy is incomplete or unavailable.');
        }
        if (active) setGalaxy(value);
      })
      .catch(() => { if (active) setUnavailable(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => { document.documentElement.lang = 'en'; }, []);
  const story = useMemo(() => galaxy ? {
    username: galaxy.username,
    title: galaxy.title,
    ringTextOne: galaxy.ring_text_one,
    ringTextTwo: galaxy.ring_text_two,
    photos: galaxy.photos.map((photo, index) => ({ src: photo.url, alt: `Love Galaxy memory ${index + 1}` })),
    musicSrc: galaxy.music_track === 'custom' ? galaxy.music_url || undefined : undefined,
  } : undefined, [galaxy]);
  if (galaxy && story) return <LoveGalaxyExperience story={story} journeyEnabled />;
  return <main className="lg-share-status" role={loading ? 'status' : 'alert'}>{loading ? <LoaderCircle size={23} className="lg-spin"/> : <LockKeyhole size={23}/>}<h1>{loading ? 'Opening your Love Galaxy…' : 'This Love Galaxy is private or unavailable.'}</h1><p>{loading ? 'Preparing the published memories.' : 'Check that you have the complete share link, including its key.'}</p></main>;
}
