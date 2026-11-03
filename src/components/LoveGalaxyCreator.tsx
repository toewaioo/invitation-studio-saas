import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, Download, ImagePlus, LoaderCircle, Music2, Play, QrCode, ShieldCheck, Sparkles, UploadCloud } from 'lucide-react';
import LoveGalaxyExperience, { type LoveGalaxyStory } from './LoveGalaxyExperience';
import { createLoveGalaxy, LOVE_GALAXY_MUSIC_BYTES, LOVE_GALAXY_PHOTO_COUNT, publishedLoveGalaxyUrl, type LoveGalaxy, type LoveGalaxyMusicTrack } from '../lib/loveGalaxy';
import { verifiedHeartQr, type VerifiedHeartQr } from '../lib/shareQr';
import './love-galaxy-create.css';

const PHOTO_MAX = 4_490_000;
const audioTypes = ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/x-wav'];

export default function LoveGalaxyCreator() {
  const [lang, setLang] = useState<'en' | 'my'>(() => localStorage.getItem('metta-language') === 'en' ? 'en' : 'my');
  const [title, setTitle] = useState('Our Love Galaxy');
  const [ringOne, setRingOne] = useState('MEMORIES ARE OUR STARS');
  const [ringTwo, setRingTwo] = useState('TWO HEARTS, ONE HORIZON');
  const [musicTrack, setMusicTrack] = useState<LoveGalaxyMusicTrack>('cosmic-orbit');
  const [journeyDiscoveryEnabled, setJourneyDiscoveryEnabled] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [musicFile, setMusicFile] = useState<File | undefined>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [published, setPublished] = useState<LoveGalaxy | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const localReviewOnly = ['localhost', '127.0.0.1'].includes(host) || host.endsWith('.manus.computer');
  const t = (en: string, my: string) => lang === 'en' ? en : my;

  useEffect(() => { document.documentElement.lang = lang; localStorage.setItem('metta-language', lang); }, [lang]);
  const photoUrls = useMemo(() => photos.map(file => URL.createObjectURL(file)), [photos]);
  useEffect(() => () => photoUrls.forEach(URL.revokeObjectURL), [photoUrls]);
  const musicUrl = useMemo(() => musicFile ? URL.createObjectURL(musicFile) : undefined, [musicFile]);
  useEffect(() => () => { if (musicUrl) URL.revokeObjectURL(musicUrl); }, [musicUrl]);

  const story = useMemo<LoveGalaxyStory>(() => ({
    title,
    ringTextOne: ringOne,
    ringTextTwo: ringTwo,
    photos: photoUrls.map((src, index) => ({ src, alt: photos[index]?.name || `Memory photo ${index + 1}` })),
    musicSrc: musicTrack === 'custom' ? musicUrl : undefined,
  }), [title, ringOne, ringTwo, photoUrls, photos, musicTrack, musicUrl]);

  const choosePhotos = (list: FileList | null) => {
    if (!list) return;
    const next = Array.from(list);
    if (next.length !== LOVE_GALAXY_PHOTO_COUNT) { setError(t('Select exactly four memory photos at once.', 'အမှတ်တရဓာတ်ပုံ လေးပုံတိတိကို တစ်ကြိမ်ရွေးပါ။')); return; }
    if (next.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type.toLowerCase()) || file.size > PHOTO_MAX || file.size < 1)) {
      setError(t('Use JPG, PNG or WEBP files, up to 4.49 MB each.', 'JPG၊ PNG သို့မဟုတ် WEBP၊ တစ်ပုံလျှင် 4.49 MB အထိ အသုံးပြုပါ။')); return;
    }
    setPhotos(next); setError('');
  };
  const chooseMusic = (list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    if (!audioTypes.includes(file.type.toLowerCase()) || file.size > LOVE_GALAXY_MUSIC_BYTES || file.size < 1) {
      setError(t('Choose MP3, M4A, AAC, OGG or WAV music up to 4 MB.', '4 MB အထိ MP3၊ M4A၊ AAC၊ OGG သို့မဟုတ် WAV သီချင်းရွေးပါ။')); return;
    }
    setMusicFile(file); setMusicTrack('custom'); setError('');
  };
  const publish = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    if (localReviewOnly) { setError(t('Publishing is unavailable in this UI-only review preview. No files were uploaded.', 'ဤ UI အစမ်းကြည့်ရှုမှုတွင် ထုတ်ဝေ၍မရပါ။ ဖိုင်များကို မတင်ထားပါ။')); return; }
    setBusy(true);
    try {
      const galaxy = await createLoveGalaxy({ title, ring_text_one: ringOne, ring_text_two: ringTwo, music_track: musicTrack, journey_discovery_enabled: journeyDiscoveryEnabled }, photos, musicFile);
      setPublished(galaxy);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('Could not publish your Love Galaxy. Try again.', 'Love Galaxy ကို မမျှဝေနိုင်ပါ။ ပြန်စမ်းပါ။'));
    } finally { setBusy(false); }
  };

  if (previewOpen) return <LoveGalaxyExperience story={story} onBack={() => setPreviewOpen(false)} />;
  if (published) return <PublishedLoveGalaxy galaxy={published} lang={lang} onHome={() => { location.href = '/'; }} />;

  return <main className="lg-creator-page">
    <header className="lg-creator-header">
      <a className="lg-creator-brand" href="/" aria-label="Back to the public showcase"><span className="lg-creator-mark"><Sparkles size={18}/></span><span>Love Galaxy<small>Memory universe</small></span></a>
      <div className="lg-creator-header-actions"><div className="lg-creator-language" aria-label="Language"><button type="button" aria-pressed={lang === 'my'} onClick={() => setLang('my')}>မြန်မာ</button><button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button></div><a href="/" className="lg-creator-back"><ArrowLeft size={15}/>{t('Showcase', 'ပင်မစာမျက်နှာ')}</a></div>
    </header>
    <div className="lg-creator-wrap">
      <div className="lg-creator-intro"><span className="lg-creator-eyebrow"><Sparkles size={14}/>{t('A universe made from your memories', 'သင့်အမှတ်တရများမှ ဖန်တီးထားသော စကြဝဠာ')}</span><h1>{t('Create your Love Galaxy', 'သင့် Love Galaxy ကို ဖန်တီးပါ')}</h1><p>{t('Add four personal photos, write the words on both orbiting rings, choose music, and publish a private-by-link experience.', 'ကိုယ်ပိုင်ဓာတ်ပုံ လေးပုံထည့်၊ လှည့်ပတ်နေသောစာသားကွင်းနှစ်ခုကို ရေး၊ သီချင်းရွေးပြီး လင့်ခ်ဖြင့်မျှဝေပါ။')}</p></div>
      <form className="lg-creator-form" onSubmit={event => void publish(event)}>
        {localReviewOnly && <p className="lg-creator-hint" role="note"><ShieldCheck size={13}/>{t('UI review preview only: publishing is disabled here, and no photos or music will be uploaded.', 'UI အစမ်းကြည့်ရှုမှုသာဖြစ်သည်။ ဤနေရာတွင် ထုတ်ဝေခြင်းကို ပိတ်ထားပြီး ဓာတ်ပုံ သို့မဟုတ် သီချင်းကို မတင်ပါ။')}</p>}
        <section className="lg-creator-card" aria-labelledby="lg-photos-title">
          <div className="lg-creator-step"><span>01</span><div><h2 id="lg-photos-title">{t('Your four memory photos', 'သင့်အမှတ်တရဓာတ်ပုံ လေးပုံ')}</h2><p>{t('The four distinct images repeat across 1,200 floating cards.', 'ကွဲပြားသော ဓာတ်ပုံလေးပုံကို လွင့်မျောနေသည့် ကတ် ၁,၂၀၀ တွင် ထပ်ခါတလဲလဲ ပြသမည်။')}</p></div></div>
          <label className="lg-upload-zone"><ImagePlus size={23}/><strong>{photos.length === 4 ? t('Replace the four photos', 'ဓာတ်ပုံလေးပုံကို အစားထိုးပါ') : t('Choose four photos', 'ဓာတ်ပုံ လေးပုံရွေးပါ')}</strong><span>JPG · PNG · WEBP · 4.49 MB {t('each', 'အထိ')}</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => { choosePhotos(event.target.files); event.currentTarget.value = ''; }} aria-label={t('Choose four personal photos', 'ကိုယ်ပိုင်ဓာတ်ပုံ လေးပုံရွေးပါ')}/></label>
          <div className="lg-photo-slots" aria-label={t('Four selected photo slots', 'ရွေးထားသောဓာတ်ပုံ လေးနေရာ')}>
            {Array.from({ length: 4 }, (_, index) => <div className={`lg-photo-slot${photoUrls[index] ? ' filled' : ''}`} key={index}>{photoUrls[index] ? <><img src={photoUrls[index]} alt={photos[index]?.name || `Memory ${index + 1}`}/><span>{String(index + 1).padStart(2, '0')}</span></> : <><ImagePlus size={19}/><span>{String(index + 1).padStart(2, '0')}</span></>}</div>)}
          </div>
          <small className="lg-creator-hint"><ShieldCheck size={13}/>{t('Four identical files are rejected. Photos upload through the app server to private storage.', 'တူညီသောဓာတ်ပုံကို ထပ်ရွေး၍မရပါ။ ဓာတ်ပုံများကို app server မှတစ်ဆင့် သီးသန့်သိုလှောင်မှုသို့ တင်မည်။')}</small>
        </section>

        <section className="lg-creator-card" aria-labelledby="lg-rings-title">
          <div className="lg-creator-step"><span>02</span><div><h2 id="lg-rings-title">{t('Write your two ring messages', 'စာသားကွင်းနှစ်ခုတွင် စာရေးပါ')}</h2><p>{t('These phrases curve around the galaxy in your own words.', 'ဤစာသားများသည် သင့်စကားလုံးများအဖြစ် စကြဝဠာပတ်လည်တွင် ကွေးလှည့်မည်။')}</p></div></div>
          <label className="lg-ring-field"><span><i className="ring-dot pink"/> {t('Outer ring', 'အပြင်ကွင်း')}</span><input value={ringOne} onChange={event => setRingOne(event.target.value)} maxLength={64} required aria-label={t('Outer ring text', 'အပြင်စာသားကွင်း')}/><small>{ringOne.length}/64</small></label>
          <label className="lg-ring-field"><span><i className="ring-dot lilac"/> {t('Inner ring', 'အတွင်းကွင်း')}</span><input value={ringTwo} onChange={event => setRingTwo(event.target.value)} maxLength={64} required aria-label={t('Inner ring text', 'အတွင်းစာသားကွင်း')}/><small>{ringTwo.length}/64</small></label>
          <label className="lg-title-field">{t('Galaxy title', 'စကြဝဠာအမည်')}<input value={title} onChange={event => setTitle(event.target.value)} maxLength={120} required /></label>
        </section>

        <section className="lg-creator-card" aria-labelledby="lg-music-title">
          <div className="lg-creator-step"><span>03</span><div><h2 id="lg-music-title">{t('Choose your music', 'သီချင်းရွေးပါ')}</h2><p>{t('The song starts when someone enters the experience.', 'ဧည့်သည်က စကြဝဠာထဲ ဝင်သည့်အခါ သီချင်းစတင်မည်။')}</p></div></div>
          <div className="lg-music-options">
            <label className={`lg-music-option${musicTrack === 'cosmic-orbit' ? ' selected' : ''}`}><input type="radio" name="lg-music" checked={musicTrack === 'cosmic-orbit'} onChange={() => { setMusicTrack('cosmic-orbit'); setMusicFile(undefined); setError(''); }}/><span className="lg-music-icon"><Music2 size={18}/></span><span><strong>{t('Cosmic Orbit', 'Cosmic Orbit')}</strong><small>{t('Included instrumental soundtrack', 'ပါဝင်ပြီးသား သီချင်း')}</small></span>{musicTrack === 'cosmic-orbit' && <Check size={17}/>}</label>
            <label className={`lg-music-option${musicTrack === 'custom' ? ' selected' : ''}`}><input type="radio" name="lg-music" checked={musicTrack === 'custom'} onChange={() => { setMusicTrack('custom'); setError(''); }}/><span className="lg-music-icon"><UploadCloud size={18}/></span><span><strong>{t('Upload your own track', 'ကိုယ်ပိုင်သီချင်းတင်ပါ')}</strong><small>{musicFile ? musicFile.name : t('MP3 · M4A · AAC · OGG · WAV · 4 MB max', 'MP3 · M4A · AAC · OGG · WAV · 4 MB အထိ')}</small></span>{musicTrack === 'custom' && <Check size={17}/>}</label>
          </div>
          {musicTrack === 'custom' && <label className="lg-audio-upload"><Music2 size={17}/><span>{musicFile ? t('Choose a different music file', 'အခြားသီချင်းဖိုင်ရွေးပါ') : t('Choose a music file', 'သီချင်းဖိုင်ရွေးပါ')}</span><input type="file" accept="audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav,audio/x-wav" onChange={event => { chooseMusic(event.target.files); event.currentTarget.value = ''; }} aria-label={t('Upload custom music', 'ကိုယ်ပိုင်သီချင်းတင်ပါ')}/></label>}
        </section>

        <section className="lg-creator-review"><div><h2>{t('Ready to share?', 'မျှဝေရန် အသင့်ဖြစ်ပြီလား')}</h2><p>{t('No account, saved draft, or edit link. After publishing, keep your share link and QR. Anyone with the link can view the photos and music.', 'အကောင့်၊ မူကြမ်း သို့မဟုတ် ပြင်ဆင်ရန်လင့်ခ်မရှိပါ။ ထုတ်ပြီးပါက share link နှင့် QR ကို သိမ်းထားပါ။ လင့်ခ်ရှိသူတိုင်း ဓာတ်ပုံနှင့်သီချင်းကို ကြည့်နိုင်သည်။')}</p><label className="lg-consent"><input type="checkbox" required/><span>{t('I have permission to share these photos and music.', 'ဤဓာတ်ပုံများနှင့် သီချင်းကို မျှဝေရန် ခွင့်ပြုချက်ရှိပါသည်။')}</span></label><label className="lg-journey-consent"><input type="checkbox" checked={journeyDiscoveryEnabled} onChange={event => setJourneyDiscoveryEnabled(event.target.checked)} aria-describedby="lg-journey-consent-details"/><span><strong>{t('Allow my Love Galaxy to appear as a planet in other people’s journeys (optional; off by default).', 'အခြားသူများ၏ ခရီးစဉ်တွင် ကျွန်ုပ်၏ Love Galaxy ကို ဂြိုဟ်အဖြစ် တွေ့ရှိနိုင်ရန် ခွင့်ပြုပါ (ရွေးချယ်နိုင်သည်၊ ပုံမှန်အားဖြင့် ပိတ်ထားသည်)။')}</strong><small id="lg-journey-consent-details">{t('If enabled, journey listings use only your galaxy title and share link—not your photos, ring messages, or music. This is separate from your existing share link.', 'ဖွင့်ထားပါက ခရီးစဉ်စာရင်းတွင် စကြဝဠာအမည်နှင့် share link ကိုသာ အသုံးပြုမည်—ဓာတ်ပုံ၊ စာသားကွင်းနှင့် သီချင်းကို စာရင်းတွင် မထည့်ပါ။ ဤရွေးချယ်မှုသည် လက်ရှိ share link နှင့် သီးခြားဖြစ်သည်။')}</small></span></label></div><div className="lg-review-actions"><button type="button" className="lg-preview-button" disabled={photos.length !== 4} onClick={() => setPreviewOpen(true)}><Play size={15}/>{t('Preview galaxy', 'စကြဝဠာကို ကြည့်မယ်')}</button><button type="submit" className="lg-publish-button" disabled={busy}>{busy ? <LoaderCircle size={16} className="lg-spin"/> : <ArrowRight size={16}/>} {busy ? t('Publishing…', 'ထုတ်ဝေနေသည်…') : t('Publish & get QR', 'မျှဝေပြီး QR ရယူပါ')}</button></div></section>
        {error && <p className="lg-creator-error" role="alert">{error}</p>}
        <p className="lg-server-note"><ShieldCheck size={13}/>{t('Your photo files never upload directly from this page to cloud storage.', 'ဓာတ်ပုံများကို ဤစာမျက်နှာမှ cloud သိုလှောင်မှုသို့ တိုက်ရိုက်မတင်ပါ။')}</p>
      </form>
    </div>
  </main>;
}

function PublishedLoveGalaxy({ galaxy, lang, onHome }: { galaxy: LoveGalaxy; lang: 'en' | 'my'; onHome: () => void }) {
  const t = (en: string, my: string) => lang === 'en' ? en : my;
  const url = publishedLoveGalaxyUrl(galaxy, location.origin);
  const [qr, setQr] = useState<VerifiedHeartQr | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrError, setQrError] = useState('');
  useEffect(() => {
    if (!url) return;
    let live = true; let result: VerifiedHeartQr | undefined;
    void verifiedHeartQr(url).then(value => { if (!live) { URL.revokeObjectURL(value.preview); return; } result = value; setQr(value); }).catch(() => setQrError(t('QR could not be scan-verified. Copy and keep the share link.', 'QR scan စစ်ဆေးမှု မအောင်မြင်ပါ။ share link ကို ကူးပြီးသိမ်းပါ။')));
    return () => { live = false; if (result) URL.revokeObjectURL(result.preview); };
  }, [url]);
  const copy = async () => { if (!url) return; try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); } };
  return <main className="lg-creator-page lg-published-page"><header className="lg-creator-header"><a className="lg-creator-brand" href="/"><span className="lg-creator-mark"><Check size={18}/></span><span>Love Galaxy<small>{t('Published', 'ထုတ်ဝေပြီး')}</small></span></a></header><section className="lg-published-card"><span className="lg-published-check"><Check size={22}/></span><span className="lg-creator-eyebrow">{t('Your memory universe is live', 'သင့်အမှတ်တရစကြဝဠာကို မျှဝေထားပါပြီ')}</span><h1>{galaxy.title}</h1><p>{t('Here is the only link for your guests. Save it now; there is no account or edit link.', 'ဧည့်သည်များအတွက် share link တစ်ခုတည်းကို အောက်တွင်ပေးထားသည်။ အကောင့်နှင့် ပြင်ဆင်ရန်လင့်ခ် မရှိသောကြောင့် ယခုသိမ်းထားပါ။')}</p>{qr ? <a className="lg-published-qr" href={qr.preview} target="_blank" rel="noopener noreferrer"><img src={qr.preview} alt={t('Scan-verified heart QR for this Love Galaxy share link', 'ဤ Love Galaxy share link အတွက် စစ်ဆေးပြီးသော heart QR')} /></a> : <div className="lg-qr-pending" role={qrError ? 'alert' : 'status'}>{qrError ? <QrCode size={24}/> : <LoaderCircle size={22} className="lg-spin"/>}<span>{qrError || t('Generating and scan-checking QR…', 'QR ထုတ်ပြီး scan စစ်ဆေးနေသည်…')}</span></div>}{url && <label className="lg-published-link">{t('Love Galaxy share link', 'Love Galaxy share link')}<span><input value={url} readOnly onFocus={event => event.target.select()} aria-label={t('Share link', 'Share link')}/><button type="button" onClick={() => void copy()} aria-label={t('Copy share link', 'Share link ကူးရန်')}>{copied ? <Check size={16}/> : <Copy size={16}/>}</button></span></label>}{copied && <small role="status">{t('Link copied.', 'လင့်ခ်ကူးပြီးပါပြီ။')}</small>}{qr && <a className="lg-download-qr" href={qr.preview} download={`love-galaxy-${galaxy.username}-heart-qr.png`}><Download size={15}/>{t('Download verified QR', 'စစ်ဆေးပြီး QR ကို download လုပ်ပါ')}</a>}{qrError && <small className="lg-creator-error" role="alert">{qrError}</small>}<button type="button" className="lg-published-home" onClick={onHome}>{t('Back to showcase', 'ပင်မစာမျက်နှာသို့ ပြန်ရန်')}<ArrowRight size={15}/></button></section></main>;
}
