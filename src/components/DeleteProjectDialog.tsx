import { useState } from 'react';
import { AlertTriangle, LoaderCircle, Trash2, X } from 'lucide-react';
import type { Language, Project } from '../types';

interface Props {
  project: Project;
  lang: Language;
  busy: boolean;
  onConfirm: (username: string) => void;
  onClose: () => void;
}

export default function DeleteProjectDialog({ project, lang, busy, onConfirm, onClose }: Props) {
  const [confirmation, setConfirmation] = useState('');
  const matches = confirmation.trim().toLowerCase() === project.username.toLowerCase();
  const t = (en: string, my: string) => lang === 'en' ? en : my;

  return <dialog
    className="delete-project-dialog"
    aria-labelledby="delete-project-title"
    ref={node => { if (node && !node.open) node.showModal(); }}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
  >
    <div className="delete-project-heading">
      <span className="delete-project-warning"><AlertTriangle size={20}/></span>
      <button className="icon-button" aria-label={t('Close confirmation','အတည်ပြုစာမျက်နှာပိတ်ရန်')} onClick={onClose} disabled={busy}><X size={18}/></button>
    </div>
    <h2 id="delete-project-title">{t('Delete invitation permanently?','ဖိတ်စာကို အပြီးတိုင်ဖျက်မလား။')}</h2>
    <p className="delete-project-summary">{t(`“${project.title}” and its stored photos will be permanently deleted. This cannot be undone.`, `“${project.title}” နှင့် သိမ်းထားသော ဓာတ်ပုံများကို အပြီးတိုင်ဖျက်မည်ဖြစ်ပြီး ပြန်ယူ၍မရပါ။`)}</p>
    <div className="delete-project-link-warning">
      <strong>{t('What happens to its links','လင့်ခ်များအပေါ် သက်ရောက်မှု')}</strong>
      <p>{t(`The short link /i/${project.username} will show no invitation until that username is reused; if reused, the old short link will open the new invitation. Old key-bearing links will not open the replacement.`, `/i/${project.username} အတိုလင့်ခ်သည် ဤအမည်ကို ပြန်သုံးသည့်အထိ ဖိတ်စာမပြနိုင်ပါ။ ပြန်သုံးပါက လင့်ခ်အဟောင်းမှ ဖိတ်စာအသစ်ကို ပြမည်။ သော့ပါလင့်ခ်အဟောင်းက ဖိတ်စာအသစ်ကို မဖွင့်နိုင်ပါ။`)}</p>
    </div>
    <label className="delete-project-confirm-label" htmlFor="delete-project-confirmation">
      {t('Type this username to confirm','အတည်ပြုရန် ဤအသုံးပြုသူအမည်ကို ရိုက်ထည့်ပါ')}
      <strong>{project.username}</strong>
      <input
        id="delete-project-confirmation"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={confirmation}
        onChange={event => setConfirmation(event.target.value)}
        placeholder={project.username}
      />
    </label>
    <div className="delete-project-actions">
      <button className="secondary" onClick={onClose} disabled={busy}>{t('Cancel','မလုပ်တော့ပါ')}</button>
      <button className="danger-primary" onClick={() => onConfirm(confirmation.trim())} disabled={!matches || busy}>
        {busy ? <LoaderCircle size={15} className="spin"/> : <Trash2 size={15}/>}
        {t('Delete permanently','အပြီးတိုင်ဖျက်မည်')}
      </button>
    </div>
  </dialog>;
}
