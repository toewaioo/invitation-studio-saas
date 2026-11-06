import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, ExternalLink, LoaderCircle, QrCode, RefreshCw, X } from 'lucide-react';
import type { Language, Project } from '../types';
import { HEART_QR, hasHighContrastQrColor, publishedShareUrl, qrColorContrastRatio, verifiedHeartQr, type VerifiedHeartQr } from '../lib/shareQr';
import { isSupabaseConfigured, repository } from '../lib/repository';
import './share-dialog.css';

interface Props { guest?: boolean; project: Project; lang: Language; onClose: () => void; onProjectChanged?: () => void }

export default function ShareDialog(props: Props) {
  const url = publishedShareUrl(props.project, location.origin);
  // Do not expose link or QR UI for drafts, revoked links, or incomplete publish results.
  if (!url) return null;
  return <PublishedShareDialog key={url} {...props} url={url} />;
}

function PublishedShareDialog({ project, lang, onClose, onProjectChanged, url, guest=false }: Props & { url: string }) {
  const t = (en: string, my: string) => lang === 'en' ? en : my;
  const dialog = useRef<HTMLDialogElement>(null);
  const [qr, setQr] = useState<(VerifiedHeartQr & { url: string; color: string }) | null>(null);
  const [qrColor, setQrColor] = useState(HEART_QR.color);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const validQrColor = hasHighContrastQrColor(qrColor);
  const contrastRatio = qrColorContrastRatio(qrColor);
  const activeQr = !validationError && qr?.url === url && qr.color === qrColor ? qr : null;
  const validateLatest = useCallback(async () => {
    try {
      if (guest) {
        await repository.publicProject(project.username);
        setValidationError('');
        return true;
      }
      const latest = await repository.get(project.id);
      if (publishedShareUrl(latest, location.origin) !== url) {
        setValidationError(lang === 'en' ? 'This invitation link has changed or sharing has stopped. Reopen sharing from the current project.' : 'ဖိတ်စာလင့်ခ် ပြောင်းထားသည် သို့မဟုတ် မျှဝေမှုရပ်ထားသည်။ လက်ရှိပရောဂျက်မှ ပြန်ဖွင့်ပါ။');
        onProjectChanged?.();
        return false;
      }
      setValidationError('');
      return true;
    } catch {
      setValidationError(lang === 'en' ? 'Could not confirm the current published link. Retry when connected.' : 'လက်ရှိမျှဝေထားသောလင့်ခ်ကို အတည်မပြုနိုင်ပါ။ ချိတ်ဆက်မှုရလျှင် ပြန်စမ်းပါ။');
      return false;
    }
  }, [project.id, project.username, project.public_key, url, lang, onProjectChanged, guest]);
  useEffect(() => {
    const recheck = () => { if (document.visibilityState === 'visible') void validateLatest(); };
    window.addEventListener('focus', recheck); document.addEventListener('visibilitychange', recheck);
    return () => { window.removeEventListener('focus', recheck); document.removeEventListener('visibilitychange', recheck); };
  }, [validateLatest]);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  useEffect(() => {
    let live = true;
    let generated: VerifiedHeartQr | undefined;
    setQr(null); setError(''); setCopied(false); setCopyError('');
    (async () => {
      if (!hasHighContrastQrColor(qrColor)) throw new Error('Choose a darker QR color');
      if (!await validateLatest()) throw new Error('Share changed');
      const result = await verifiedHeartQr(url, qrColor);
      if (live && !await validateLatest()) {
        URL.revokeObjectURL(result.preview);
        throw new Error('Share changed during QR generation');
      }
      return result;
    })().then(result => {
      if (!live) { URL.revokeObjectURL(result.preview); return; }
      generated = result;
      setQr({ ...result, url, color: qrColor });
    }).catch(() => {
      if (live) setError(t('QR scan verification did not complete. Retry, or copy the link below. No unverified image can be downloaded.', 'QR scan စစ်ဆေးမှု မပြီးပါ။ ပြန်စမ်းပါ သို့မဟုတ် အောက်ပါလင့်ခ်ကို ကူးယူပါ။ မစစ်ဆေးရသေးသော QR ပုံကို download မပေးပါ။'));
    });
    return () => { live = false; if (generated) URL.revokeObjectURL(generated.preview); };
  }, [url, retry, lang, validateLatest, qrColor]);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 3000); return () => clearTimeout(timer); }, [copied]);
  const copy = async () => {
    setActionBusy(true);
    try { if (!await validateLatest()) return; await navigator.clipboard.writeText(url); setCopied(true); setCopyError(''); }
    catch { setCopyError(t('Select and copy the link below.', 'အောက်ပါလင့်ခ်ကို ရွေး၍ ကူးယူပါ။')); }
    finally { setActionBusy(false); }
  };
  const download = async () => {
    if (!activeQr) return;
    setActionBusy(true);
    try {
      if (!await validateLatest()) return;
      const link = document.createElement('a');
      link.href = activeQr.preview;
      link.download = `invitation-${project.username}-heart-qr.png`;
      link.click();
    } finally { setActionBusy(false); }
  };
  const open = async () => {
    // Open synchronously during the click, then navigate only after current-key validation.
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    setActionBusy(true);
    try {
      if (!await validateLatest()) { tab?.close(); return; }
      if (tab) tab.location.replace(url);
      else setCopyError(t('Your browser blocked the new tab. Copy the verified link below.', 'Browser က tab အသစ်ကို ပိတ်ထားသည်။ အောက်ပါအတည်ပြုပြီးလင့်ခ်ကို ကူးယူပါ။'));
    } finally { setActionBusy(false); }
  };
  return <dialog ref={dialog} className="share-dialog" aria-labelledby="share-dialog-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="share-dialog-header"><div><span className="share-published"><Check size={13} />{t('Published invitation', 'မျှဝေထားသောဖိတ်စာ')}</span><h2 id="share-dialog-title">{t('Share your invitation', 'ဖိတ်စာလင့်ခ်နှင့် QR')}</h2></div><button type="button" className="icon-button" aria-label={t('Close sharing', 'မျှဝေခြင်းပိတ်ရန်')} onClick={onClose}><X size={20} /></button></header>
    <p className="share-full-names"><span>{project.person_a}</span><i>&</i><span>{project.person_b}</span></p>
    {!isSupabaseConfigured && <p className="share-local-note">{t('LOCAL DEMO — this link opens only in this browser on this origin. This is not a live public invitation.', 'စမ်းသပ်မုဒ် — ဤလင့်ခ်သည် လက်ရှိ browser/origin တွင်သာ အလုပ်လုပ်သည်။ Live public ဖိတ်စာ မဟုတ်ပါ။')}</p>}
    <div className="share-qr-preview" aria-busy={!activeQr && !error}>
      {activeQr ? <a href={activeQr.preview} target="_blank" rel="noopener noreferrer" aria-label={t('Enlarge verified heart QR', 'စစ်ဆေးပြီးသော heart QR ကို အကြီးကြည့်ရန်')}><img src={activeQr.preview} alt={t('Heart-shaped QR in your selected color, encoding this exact published invitation link', 'သင်ရွေးထားသောအရောင်ရှိ နှလုံးပုံ QR တွင် မျှဝေထားသောဖိတ်စာလင့်ခ်ကို တိတိကျကျ ထည့်ထားသည်')} width={HEART_QR.svgWidth} height={HEART_QR.height} /></a> : (validationError || error) ? <div className="share-qr-status" role="alert"><QrCode size={26}/><p>{validQrColor ? validationError || error : t('Choose a darker color to keep the QR easy to scan.', 'QR ကို လွယ်ကူစွာ scan ဖတ်နိုင်ရန် ပိုမိုနက်သောအရောင်ကို ရွေးပါ။')}</p>{validQrColor && <button className="secondary small" type="button" onClick={() => setRetry(value => value + 1)}><RefreshCw size={14}/>{t('Retry QR', 'QR ပြန်စမ်းရန်')}</button>}</div> : <div className="share-qr-status" role="status"><LoaderCircle size={24} className="spin"/><p>{t('Generating and scan-checking QR…', 'QR ထုတ်ပြီး scan စစ်ဆေးနေပါသည်…')}</p></div>}
    </div>
    <div className="share-qr-color-control"><label htmlFor="heart-qr-color">{t('QR color', 'QR အရောင်')}</label><div><input id="heart-qr-color" type="color" value={qrColor} onChange={event => setQrColor(event.target.value.toUpperCase())} aria-describedby="heart-qr-color-help"/><span>{qrColor.toUpperCase()}</span></div><p id="heart-qr-color-help">{validQrColor ? t(`Contrast ${contrastRatio?.toFixed(1)}:1 on white.`, `အဖြူနောက်ခံပေါ် contrast ${contrastRatio?.toFixed(1)}:1 ရှိသည်။`) : t('Choose a darker color for reliable scanning (at least 4.5:1 contrast on white).', 'Scan ဖတ်ရှုနိုင်ရန် ပိုမိုနက်သောအရောင်ရွေးပါ (အဖြူနောက်ခံပေါ် contrast အနည်းဆုံး 4.5:1)။')}</p></div>
    {activeQr && <p className="share-scan-verified"><Check size={14}/>{t('Scan verified · Exact link · Maximum error correction (H)', 'Scan စစ်ပြီး · လင့်ခ်တူညီ · H error correction')}</p>}
    <div className="share-link-field"><label htmlFor="published-share-url">{t('Final share link', 'နောက်ဆုံးမျှဝေရန်လင့်ခ်')}</label><div><input id="published-share-url" value={url} readOnly onFocus={event => event.target.select()} spellCheck={false}/><button type="button" className="icon-button" aria-label={t('Copy final share link', 'နောက်ဆုံးလင့်ခ်ကူးရန်')} disabled={actionBusy || !!validationError} onClick={() => void copy()}>{copied ? <Check size={17}/> : <Copy size={17}/>}</button></div>{copyError && <small role="status">{copyError}</small>}{copied && <small role="status">{t('Link copied.', 'လင့်ခ်ကူးပြီးပါပြီ။')}</small>}</div>
    <div className="share-dialog-actions"><button type="button" className="primary" disabled={!activeQr || actionBusy} onClick={() => void download()}><Download size={16}/>{t('Download heart QR', 'Heart QR download')}</button><button type="button" className="share-open-link" disabled={actionBusy || !!validationError} onClick={() => void open()}>{t('Open invitation', 'ဖိတ်စာဖွင့်ရန်')}<ExternalLink size={14}/></button></div>
    <p className="share-expiry-note">{guest ? t('Keep your share name. There is no account, saved draft or edit link. Anyone who knows or guesses the name can view your invitation. Keep the white margin intact when printing.', 'မျှဝေအမည်ကို သိမ်းထားပါ။ အကောင့်၊ မူကြမ်းနှင့် ပြန်ပြင်ရန်လင့်ခ် မရှိပါ။ အမည်ကို သိသူ သို့မဟုတ် ခန့်မှန်းမိသူတိုင်း ဖိတ်စာကို ကြည့်နိုင်ပါသည်။ ပုံနှိပ်ရာတွင် အဖြူရောင်ဘောင်ကို မဖြတ်ပါနှင့်။') : t('Editing or stopping sharing hides this link while the project is a draft. Republishing under the same share name reactivates the same short link; a prior key-bearing link stays invalid. Keep the white margin intact when printing.', 'ပြင်ဆင်ခြင်း သို့မဟုတ် မျှဝေမှုရပ်ခြင်းဖြင့် မူကြမ်းကာလအတွင်း လင့်ခ်ကို ပိတ်ထားမည်။ အမည်တူဖြင့် ပြန်မျှဝေပါက လင့်ခ်တူကို ပြန်ဖွင့်မည်၊ ယခင်သော့ပါလင့်ခ်ကတော့ မဖွင့်နိုင်ပါ။ ပုံနှိပ်ရာတွင် အဖြူရောင်ဘောင်ကို မဖြတ်ပါနှင့်။')}</p>
  </dialog>;
}
