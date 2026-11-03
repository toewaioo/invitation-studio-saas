import { useEffect, useState } from 'react';
import { text, venueMap } from './invitationData';

/** Never derives a destination from the venue label or another invitation. */
export default function VenueMiniMap({ venue, supplied }: { venue: string; supplied: string }) {
  const map = venueMap(venue, supplied);
  const [resolved, setResolved] = useState({ href: '', embed: '' });
  const embed = map.embed || (resolved.href === map.href ? resolved.embed : '');
  useEffect(() => {
    if (!map.href || map.embed) return;
    const controller = new AbortController();
    fetch(`/api/venue-map?url=${encodeURIComponent(map.href)}`, {
      signal: controller.signal, credentials: 'omit',
    }).then(async response => {
      if (!response.ok) return;
      const result = await response.json();
      // Trust only an embed that passes the same Google-only URL validator.
      const safe = typeof result.embed === 'string' ? venueMap('', result.embed) : null;
      if (!controller.signal.aborted && safe?.embed) setResolved({ href: map.href, embed: safe.embed });
    }).catch(() => { /* Keep the exact supplied external link available. */ });
    return () => controller.abort();
  }, [map.href, map.embed]);
  if (!map.href) return null;
  return embed ? <div className="mini-map">
    <iframe src={embed} data-map-src={embed} title={`${text(venue, 'ပွဲနေရာ')} တည်နေရာမြေပုံ`} loading="lazy" referrerPolicy="no-referrer" tabIndex={-1} />
    <a href={map.href} target="_blank" rel="noopener noreferrer" aria-label="Open venue in Google Maps">
      <span className="map-pin" aria-hidden="true">⌖</span>
      <span className="map-caption">Google Maps မှာ အကြီးကြည့်ရန် ↗</span>
    </a>
  </div> : <p className="soft-copy">ပေးထားသော မြေပုံလင့်ခ်ကို အောက်ပါခလုတ်မှ ဖွင့်နိုင်ပါသည်။</p>;
}
