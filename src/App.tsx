import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, CircleHelp, Copy, FileText, FolderOpen, LayoutTemplate, Link2Off, LoaderCircle, LockKeyhole, LogIn, LogOut, MoreHorizontal, Pencil, Plus, QrCode, Search, ShieldCheck, Users, X } from 'lucide-react';
import type { Design, Language, Project } from './types';
import { projectTypes } from './types';
import { createDesignPreview } from './lib/designPreview';
import { INVITATION_TEMPLATES } from './templates/registry';
import { repository, isSupabaseConfigured } from './lib/repository';
import { ownerAuth, type OwnerSession } from './lib/api';
import Editor from './components/Editor';
import Invitation from './components/Invitation';
import InvitationStatus from './components/InvitationStatus';
import ShareDialog from './components/ShareDialog';
import Showcase from './components/Showcase';
import { studioRoute, workspaceAccess } from './lib/access';
import { publishedShareUrl } from './lib/shareQr';

const LoveGalaxyExperience = lazy(() => import('./components/LoveGalaxyExperience'));
const LoveGalaxyCreator = lazy(() => import('./components/LoveGalaxyCreator'));
const LoveGalaxyPublic = lazy(() => import('./components/LoveGalaxyPublic'));

const designs = INVITATION_TEMPLATES.map(({ id, name, descriptionEn, descriptionMy }) => ({
  id, name, description: descriptionEn, description_my: descriptionMy,
}));
const designName = (id:string) => designs.find(d=>d.id===id)?.name || id;

export default function App() {
  const pathname = location.pathname.replace(/\/+$/, '') || '/';
  if (pathname === '/love-galaxy/create') return <Suspense fallback={<main className="lg-share-status" role="status">Opening Love Galaxy creator…</main>}><LoveGalaxyCreator /></Suspense>;
  if (/^\/love\/galaxy-[a-z0-9-]{8,39}$/.test(pathname)) return <Suspense fallback={<main data-experience="love-galaxy-loading" aria-label="Loading shared Love Galaxy" style={{position:'fixed',inset:0,background:'#03040a'}}/>}><LoveGalaxyPublic /></Suspense>;
  if (pathname === '/love-galaxy') return <Suspense fallback={<main data-experience="love-galaxy-loading" aria-label="Loading Love Galaxy 3D scene" style={{position:'fixed',inset:0,background:'#03040a'}}/>}><LoveGalaxyExperience /></Suspense>;
  return <InvitationStudioApp />;
}

function InvitationStudioApp() {
  const [lang,setLang] = useState<Language>(()=>localStorage.getItem('metta-language')==='en'?'en':'my');
  const t=(en:string,my:string)=>lang==='en'?en:my;
  const [view,setView]=useState<'projects'|'customers'|'designs'>('projects');
  const [projects,setProjects]=useState<Project[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [toast,setToast]=useState('');
  const route=studioRoute(location.pathname);
  const isManagement=route==='manage';
  const [userId,setUserId]=useState<string|null>(null);
  const [adminUserId,setAdminUserId]=useState('');
  const access=workspaceAccess(route,userId,adminUserId);
  const accessRef=useRef(false);accessRef.current=access;
  const [guestPublished,setGuestPublished]=useState<Project|null>(null);
  const [guestEditor,setGuestEditor]=useState(route==='create');
  const [editor,setEditor]=useState<Project|'new'|null>(null);
  const [preview,setPreview]=useState<Project|null>(null);
  const [shareProjectId,setShareProjectId]=useState<string|null>(null);
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('all');
  const [sessionReady,setSessionReady]=useState(false);
  const [authChecking,setAuthChecking]=useState(isSupabaseConfigured);
  const [authOpen,setAuthOpen]=useState(false);
  const [authEmail,setAuthEmail]=useState('');
  const [authPassword,setAuthPassword]=useState('');
  const [authBusy,setAuthBusy]=useState(false);
  const [authError,setAuthError]=useState('');
  const [customerKey,setCustomerKey]=useState<string|null>(null);
  const [publicState,setPublicState]=useState<{project?:Project;error?:string}|null>(null);
  const isPublic=route==='invitation';
  const [publicLoading,setPublicLoading]=useState(isPublic);
  const [publicAttempt,setPublicAttempt]=useState(0);
  const refresh=useCallback(async()=>{if(!accessRef.current)return;setLoading(true);try{const rows=await repository.list();if(accessRef.current){setProjects(rows);setError('');}}catch(e){if(accessRef.current)setError(e instanceof Error?e.message:String(e));}finally{setLoading(false);}},[]);
  const retryPublic=()=>{setPublicState(null);setPublicLoading(true);setPublicAttempt(attempt=>attempt+1);};
  useEffect(()=>{document.documentElement.lang=lang;localStorage.setItem('metta-language',lang);},[lang]);
  useEffect(()=>{
    if(isPublic){
      let active=true;
      let username='';try{username=decodeURIComponent(location.pathname.slice(3));}catch{}
      const key=new URLSearchParams(location.search).get('key')||'';
      setPublicLoading(true);
      setPublicState(null);
      repository.publicProject(username,key)
        .then(project=>{if(active)setPublicState({project});})
        .catch(()=>{if(active)setPublicState({error:'This invitation is private or unavailable. / ဤဖိတ်စာကို မရရှိနိုင်ပါ။'});})
        .finally(()=>{if(active)setPublicLoading(false);});
      return()=>{active=false;};
    }
    if(!isManagement||!isSupabaseConfigured){setSessionReady(false);setAuthChecking(false);return;}
    let active=true;
    const applySession=(session:OwnerSession)=>{if(!active)return;const id=session.user?.id||null;setUserId(id);setAdminUserId(session.isOwner&&id?id:'');setSessionReady(!!id&&session.isOwner);accessRef.current=isManagement&&!!id&&session.isOwner;setAuthChecking(false);if(id&&session.isOwner){setAuthOpen(false);setAuthPassword('');}else{setPreview(null);setProjects([]);setEditor(null);setCustomerKey(null);setShareProjectId(null);}};
    const unsubscribe=ownerAuth.subscribe(applySession);
    ownerAuth.session().then(applySession).catch(()=>{if(active){setAuthChecking(false);setError('Could not check your session. Please try again.');}});
    return()=>{active=false;unsubscribe();};
  },[isPublic,isManagement,route,publicAttempt]);
  useEffect(()=>{if(access&&!isPublic)void refresh();},[access,isPublic,refresh]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(timer);},[toast]);
  const create=()=>{if(!access){setAuthOpen(true);return;}setEditor('new');};
  const share=async(p:Project)=>{const url=publishedShareUrl(p,location.origin);if(!url)return;try{await navigator.clipboard.writeText(url);setToast(t('Share link copied.','မျှဝေရန်လင့်ခ် ကူးယူပြီးပါပြီ။'));}catch{window.prompt(t('Copy share link','မျှဝေရန်လင့်ခ်ကို ကူးယူပါ'),url);}};
  const revoke=async(p:Project)=>{try{await repository.revoke(p.id);await refresh();setToast(t('Sharing disabled. The previous link is no longer active.','မျှဝေမှုရပ်ပြီးပါပြီ။ လင့်ခ်အဟောင်းကို သုံးမရတော့ပါ။'));}catch(e){setError(e instanceof Error?e.message:String(e));}};
  const previewDesign=(id:Design)=>setPreview(createDesignPreview(id,lang));
  const date=(value:string)=>{if(!value)return '—';const d=new Date(value.length===10?`${value}T12:00:00+06:30`:value);return Number.isNaN(d.getTime())?value:d.toLocaleDateString(lang==='my'?'my-MM':'en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Yangon'});};
  const count=(n:number)=>n.toLocaleString(lang==='my'?'my-MM':'en');
  if(isPublic)return publicState?.project?<Invitation project={publicState.project}/>:<InvitationStatus lang={lang} loading={publicLoading||!publicState} unavailable={!!publicState?.error} demo={!isSupabaseConfigured} onRetry={retryPublic}/>;
  const filtered=projects.filter(p=>(filter==='all'||p.status===filter)&&`${p.title} ${p.customer_name} ${p.username} ${p.person_a} ${p.person_b}`.toLowerCase().includes(query.trim().toLowerCase()));
  const customerMap=new Map<string,Project[]>();for(const p of projects){const key=(p.customer_email||p.customer_phone||p.customer_name).trim().toLowerCase();customerMap.set(key,[...(customerMap.get(key)||[]),p]);}
  const customers=[...customerMap.entries()].filter(([,ps])=>`${ps[0].customer_name} ${ps[0].customer_email} ${ps[0].customer_phone}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selectedCustomer=customerKey?customerMap.get(customerKey):undefined;
  const shareProject=projects.find(p=>p.id===shareProjectId&&p.status==='published'&&p.public_key);
  const nav=[{id:'projects' as const,label:t('Projects','ပရောဂျက်များ'),icon:FolderOpen},{id:'customers' as const,label:t('Customers','အပ်နှံသူများ'),icon:Users},{id:'designs' as const,label:t('Design library','ဒီဇိုင်းများ'),icon:LayoutTemplate}];
  const currentTitle=nav.find(n=>n.id===view)!.label;
  const go=(next:typeof view)=>{setView(next);setQuery('');};
  const sampleCover=(id:Design,small=false)=><div className={`design-cover cover-${id}${small?' compact':''}`} aria-hidden="true"><div className="cover-paper"><span className="cover-rule"/><span className="cover-arch"/><span className="cover-names"><span>{t('Min Khant','မင်းခန့်')}</span><i>&</i><span>{t('Thazin','သဇင်')}</span></span><span className="cover-caption">THE WEDDING</span></div></div>;
  const authDialog=isManagement&&authOpen&&(authOpen&&<dialog className="auth-dialog" aria-labelledby="auth-title" ref={node=>{if(node&&!node.open)node.showModal();}} onCancel={()=>{setAuthOpen(false);setAuthError('');}}><button className="icon-button dialog-close" onClick={()=>{setAuthOpen(false);setAuthError('');}} aria-label={t('Close sign in','ဝင်ရောက်ရန်စာမျက်နှာပိတ်ရန်')}><X size={18}/></button><span className="auth-symbol"><LockKeyhole size={22}/></span><h2 id="auth-title">{t('Owner sign in','ပိုင်ရှင်အကောင့်ဝင်ရန်')}</h2><p>{t('Manage your customers and invitations securely.','အပ်နှံသူနှင့် ဖိတ်စာများကို သီးသန့်စီမံနိုင်ပါသည်။')}</p><form onSubmit={async e=>{e.preventDefault();setAuthBusy(true);setAuthError('');try{await ownerAuth.signIn(authEmail,authPassword);}catch(e){setAuthError(e instanceof Error?e.message:String(e));}finally{setAuthBusy(false);}}}><label>{t('Email address','အီးမေးလ်')}<input type="email" required autoComplete="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="you@example.com"/></label><label>{t('Password','စကားဝှက်')}<input type="password" required minLength={8} autoComplete={'current-password'} value={authPassword} onChange={e=>setAuthPassword(e.target.value)}/></label>{authError&&<div className="form-error" role="alert">{authError}</div>}<button className="primary" disabled={authBusy}>{authBusy?<LoaderCircle size={16} className="spin"/>:<LogIn size={16}/>} {t('Sign in','ဝင်ရောက်ရန်')}</button></form></dialog>);
  const previewDialog=(preview&&<dialog className="preview-dialog" aria-label={t('Invitation preview','ဖိတ်စာနမူနာ')} ref={node=>{if(node&&!node.open)node.showModal();}} onCancel={e=>{e.preventDefault();setPreview(null);}}>{preview.id==='design-preview'&&<span className="sample-preview-label">{t('Sample design · Not a published invitation','ဒီဇိုင်းနမူနာ · မျှဝေထားသောဖိတ်စာ မဟုတ်ပါ')}</span>}<Invitation project={preview} preview onClose={()=>setPreview(null)}/></dialog>);
  if(!access)return <><Showcase lang={lang} onLanguage={setLang} onPreview={previewDesign} onCreate={()=>setGuestEditor(true)} workspace={isManagement} admin signedIn={sessionReady} checking={authChecking} configured={isSupabaseConfigured} onSignIn={()=>setAuthOpen(true)}/>
    {authDialog}
    {guestEditor&&<Editor guest project={null} lang={lang} onClose={()=>setGuestEditor(false)} onPreview={setPreview} onSaved={p=>{setGuestEditor(false);setGuestPublished(p);}}/>}
    {guestPublished&&<ShareDialog guest project={guestPublished} lang={lang} onClose={()=>setGuestPublished(null)}/>}
    {previewDialog}
  </>;
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">{t('Skip to content','အကြောင်းအရာသို့ သွားရန်')}</a>
    <aside className="sidebar">
      <a className="workspace-brand" href="/" aria-label="Metta Invitation Studio"><span className="brand-mark"><BookOpen size={19} strokeWidth={1.7}/></span><span>မေတ္တာစာ<small>Invitation Studio</small></span></a>
      <div className="workspace-label">{t('Workspace','လုပ်ငန်းခွင်')}</div>
      <nav aria-label={t('Main navigation','အဓိကမီနူး')}>{nav.map(n=><button key={n.id} onClick={()=>go(n.id)} className={view===n.id?'active':''} aria-current={view===n.id?'page':undefined}><n.icon size={17} strokeWidth={1.7}/><span>{n.label}</span>{n.id==='projects'&&sessionReady&&<span className="nav-count">{count(projects.length)}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="workspace-security"><ShieldCheck size={16}/><span>{t('Private workspace','သီးသန့်လုပ်ငန်းခွင်')}<small>{t('Only shared invitations are public.','မျှဝေထားသော ဖိတ်စာကိုသာ ကြည့်နိုင်သည်။')}</small></span></div><span className="sidebar-version">မေတ္တာစာ <span>Studio / 02</span></span></div>
    </aside>
    <div className="workspace-content">
      <header className="topbar"><div className="breadcrumb"><span>{t('Workspace','လုပ်ငန်းခွင်')}</span><ChevronRight size={14}/><strong>{currentTitle}</strong></div><div className="topbar-actions"><span className="connection-state"><i/>{isSupabaseConfigured?t('Cloud workspace','Cloud လုပ်ငန်းခွင်'):t('Local demo','စမ်းသပ်မုဒ်')}</span><div className="language-switch" aria-label="Language"><button aria-pressed={lang==='my'} onClick={()=>setLang('my')}>မြန်မာ</button><button aria-pressed={lang==='en'} onClick={()=>setLang('en')}>EN</button></div>{isSupabaseConfigured&&(sessionReady?<button className="icon-button" aria-label={t('Sign out','ထွက်ရန်')} title={t('Sign out','ထွက်ရန်')} onClick={()=>void ownerAuth.signOut().catch(e=>setError(e instanceof Error?e.message:String(e)))}><LogOut size={16}/></button>:<button className="secondary small" onClick={()=>setAuthOpen(true)} disabled={authChecking}><LogIn size={15}/>{t('Sign in','ဝင်ရောက်ရန်')}</button>)}</div></header>
      <main id="main-content" className="workspace-main">
        {!isSupabaseConfigured&&<div className="environment-notice"><CircleHelp size={16}/><p>{t('Local demo. Changes stay in this browser and do not affect your Supabase workspace.','စမ်းသပ်မုဒ်ဖြစ်သည်။ ပြောင်းလဲမှုများကို ဤ browser တွင်သာ သိမ်းပြီး Supabase data ကို မထိပါ။')}</p></div>}
        {error&&<div className="error-banner" role="alert"><span>{error}</span><button className="icon-button" aria-label={t('Dismiss error','အမှားစာပိတ်ရန်')} onClick={()=>setError('')}><X size={15}/></button></div>}
        <div className="page-heading"><div><h1>{currentTitle}</h1><p>{view==='projects'?t('Manage customer invitations, from first draft to shared link.','အပ်နှံသူ၏ ဖိတ်စာများကို မူကြမ်းမှ မျှဝေခြင်းအထိ စီမံပါ။'):view==='customers'?t('Customer details and the invitations you manage for them.','အပ်နှံသူအချက်အလက်နှင့် သက်ဆိုင်ရာ ဖိတ်စာများ။'):t('Three invitation experiences. Four colour palettes.','3D ဖိတ်စာ ဒီဇိုင်းသုံးမျိုးနှင့် အရောင်လေးမျိုး။')}</p></div><button className="primary" onClick={create} disabled={authChecking}><Plus size={16}/>{t('New invitation','ဖိတ်စာအသစ်')}</button></div>
        {view==='projects'?<div className="projects-layout"><section className="project-workspace" aria-label={t('Invitation projects','ဖိတ်စာပရောဂျက်များ')}>
          <div className="list-toolbar"><div className="status-tabs" aria-label={t('Project status','ပရောဂျက်အခြေအနေ')}>{[['all',t('All projects','အားလုံး')],['draft',t('Drafts','မူကြမ်း')],['published',t('Published','မျှဝေထားသည်')]].map(([id,label])=><button key={id} className={filter===id?'selected':''} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}{sessionReady&&<span>{count(id==='all'?projects.length:projects.filter(p=>p.status===id).length)}</span>}</button>)}</div><label className="search-control"><Search size={16}/><input aria-label={t('Search projects','ပရောဂျက်ရှာရန်')} placeholder={t('Search projects…','ပရောဂျက်ရှာရန်…')} value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label={t('Clear search','ရှာဖွေမှုရှင်းရန်')} onClick={()=>setQuery('')}><X size={13}/></button>}</label></div>
          <div className="project-table-wrap"><table className="project-table"><thead><tr><th>{t('Project','ပရောဂျက်')}</th><th>{t('Event date','ပွဲရက်')}</th><th>{t('Status','အခြေအနေ')}</th><th className="updated-column">{t('Updated','ပြင်ဆင်ရက်')}</th><th className="actions-heading"><span className="sr-only">{t('Actions','လုပ်ဆောင်ချက်')}</span></th></tr></thead><tbody>{sessionReady&&!loading&&filtered.map(p=><tr key={p.id}><td><div className="project-identity"><button className={`project-thumbnail thumb-${p.template}`} aria-label={`${t('Preview','ကြည့်ရန်')} ${p.title}`} onClick={()=>setPreview(p)}>{p.photos[0]?<img src={p.photos[0].url} alt=""/>:<FileText size={19}/>}</button><div><button className="project-title" onClick={()=>setEditor(p)}>{p.title}</button><span className="project-meta">{p.customer_name}<span>·</span>{designName(p.template)}</span><span className="mobile-event-date">{date(p.event_date)}</span></div></div></td><td className="date-cell">{date(p.event_date)}</td><td><span className={`project-status ${p.status}`}><i/>{p.status==='published'?t('Published','မျှဝေထားသည်'):t('Draft','မူကြမ်း')}</span></td><td className="updated-column date-cell">{date(p.updated_at)}</td><td><div className="row-actions"><button className="icon-button" aria-label={`${t('Preview','ကြည့်ရန်')} ${p.title}`} title={t('Preview 3D','3D ကြည့်ရန်')} onClick={()=>setPreview(p)}><BookOpen size={16}/></button><button className="icon-button" aria-label={`${t('Edit','ပြင်ရန်')} ${p.title}`} title={t('Edit invitation','ဖိတ်စာပြင်ရန်')} onClick={()=>setEditor(p)}><Pencil size={15}/></button>{p.status==='published'&&<details className="action-menu"><summary aria-label={`${t('More actions for','နောက်ထပ်လုပ်ဆောင်ရန်')} ${p.title}`}><MoreHorizontal size={17}/></summary><div><button onClick={()=>setShareProjectId(p.id)}><QrCode size={14}/>{t('Share link & heart QR','လင့်ခ်နှင့် Heart QR')}</button><button onClick={()=>void share(p)}><Copy size={14}/>{t('Copy share link','လင့်ခ်ကူးရန်')}</button><button className="danger-text" onClick={()=>void revoke(p)}><Link2Off size={14}/>{t('Stop sharing','မျှဝေမှုရပ်ရန်')}</button></div></details>}</div></td></tr>)}</tbody></table>
          {authChecking||loading?<div className="table-state loading-state" role="status"><LoaderCircle className="spin" size={21}/><p>{t('Loading workspace…','လုပ်ငန်းခွင် ရယူနေပါသည်…')}</p></div>:!sessionReady?<div className="table-state"><div className="empty-document"><LockKeyhole size={25} strokeWidth={1.5}/></div><h2>{t('Your projects, in one place','ပရောဂျက်များကို တစ်နေရာတည်းတွင် စီမံပါ')}</h2><p>{t('Sign in to see your customer invitations and continue your work.','အပ်နှံသူဖိတ်စာများကို ကြည့်ရှုပြင်ဆင်ရန် သင့်အကောင့်သို့ ဝင်ရောက်ပါ။')}</p><button className="primary" onClick={()=>setAuthOpen(true)}><LogIn size={15}/>{t('Sign in to workspace','အကောင့်ဝင်ရောက်ရန်')}</button><span className="empty-caption"><LockKeyhole size={12}/>{t('Customer details remain private.','အပ်နှံသူအချက်အလက်ကို သီးသန့်ထားသည်။')}</span></div>:!filtered.length?<div className="table-state"><div className="empty-document"><FolderOpen size={27} strokeWidth={1.5}/></div><h2>{query?t('No matching projects','ကိုက်ညီသောပရောဂျက် မရှိပါ'):projects.length?t('No projects in this view','ဤအမျိုးအစားတွင် ပရောဂျက်မရှိပါ'):t('Create your first invitation','ပထမဆုံးဖိတ်စာကို ဖန်တီးပါ')}</h2><p>{query?t('Try a customer name, project title or share name.','အပ်နှံသူအမည်၊ ပရောဂျက်အမည် သို့မဟုတ် မျှဝေအမည်ဖြင့် ရှာပါ။'):t('Add customer details, choose a design, then preview before publishing.','အပ်နှံသူအချက်အလက်ဖြည့်၊ ဒီဇိုင်းရွေးပြီး မမျှဝေမီ အရင်ကြည့်ပါ။')}</p>{query?<button className="secondary" onClick={()=>setQuery('')}>{t('Clear search','ရှာဖွေမှုရှင်းရန်')}</button>:<button className="primary" onClick={create}><Plus size={16}/>{t('New invitation','ဖိတ်စာအသစ်')}</button>}</div>:null}</div>
          <div className="table-footer"><span>{sessionReady?`${count(filtered.length)} ${t('projects','ပရောဂျက်')}`:t('Private workspace','သီးသန့်လုပ်ငန်းခွင်')}</span><span><LockKeyhole size={12}/>{t('Drafts are never public','မူကြမ်းများကို အများကြည့်မရပါ')}</span></div>
        </section><aside className="project-reference"><div className="aside-title"><h2>{t('Invitation designs','ဖိတ်စာဒီဇိုင်းများ')}</h2><span>{String(designs.length).padStart(2,'0')}</span></div><p>{t('Preview the experience before you choose.','မရွေးချယ်မီ 3D ဖိတ်စာကို အရင်ကြည့်ပါ။')}</p><div className="reference-designs">{designs.map(d=><button className="reference-design" key={d.id} onClick={()=>previewDesign(d.id)} aria-label={`${t('Preview design','ဒီဇိုင်းကြည့်ရန်')} ${d.name}`}>{sampleCover(d.id,true)}<span><strong>{d.name}</strong><small>{lang==='en'?d.description:d.description_my}</small></span><ArrowUpRight size={14}/></button>)}</div><button className="text-button library-link" onClick={()=>go('designs')}>{t('Browse design library','ဒီဇိုင်းအားလုံးကြည့်ရန်')}<ArrowRight size={14}/></button><div className="workflow-note"><h3>{t('Draft. Review. Share.','မူကြမ်း၊ စစ်ဆေး၊ မျှဝေ')}</h3><p>{t('Publish only when it is ready. Every edit disables the previous share link.','စိတ်တိုင်းကျမှ မျှဝေပါ။ ပြင်ဆင်သိမ်းဆည်းလျှင် လင့်ခ်အဟောင်း ပိတ်သွားပါမည်။')}</p><ShieldCheck size={17}/></div></aside></div>
        :view==='customers'?<section className="customer-workspace"><div className="customer-toolbar"><span>{sessionReady?count(customerMap.size):'—'} {t('customers','အပ်နှံသူ')}</span><label className="search-control"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} aria-label={t('Search customers','အပ်နှံသူရှာရန်')} placeholder={t('Search customers…','အပ်နှံသူရှာရန်…')}/></label></div><table className="customer-table"><thead><tr><th>{t('Customer','အပ်နှံသူ')}</th><th>{t('Contact','ဆက်သွယ်ရန်')}</th><th>{t('Projects','ပရောဂျက်များ')}</th><th>{t('Last updated','နောက်ဆုံးပြင်ဆင်ရက်')}</th></tr></thead><tbody>{customers.map(([key,ps])=><tr key={key}><td><button className="customer-name" onClick={()=>setCustomerKey(key)}><span className="customer-avatar">{ps[0].customer_name.slice(0,1)}</span>{ps[0].customer_name}<ChevronRight size={14}/></button></td><td><span>{ps[0].customer_email||ps[0].customer_phone||'—'}</span></td><td>{count(ps.length)}</td><td>{date(ps[0].updated_at)}</td></tr>)}</tbody></table>{(!sessionReady||!customers.length)&&<div className="table-state"><div className="empty-document"><Users size={26}/></div><h2>{sessionReady?t('No customers yet','အပ်နှံသူ မရှိသေးပါ'):t('Customer details are private','အပ်နှံသူအချက်အလက်သည် သီးသန့်ဖြစ်သည်')}</h2><p>{query?t('No customers match this search.','ကိုက်ညီသော အပ်နှံသူမရှိပါ။'):t('Customer records appear here when you create an invitation.','ဖိတ်စာအသစ်တွင် ဖြည့်ထားသည့် အပ်နှံသူအချက်အလက်များကို ဤနေရာတွင် တွေ့ရမည်။')}</p><button className="secondary" onClick={create}>{sessionReady?t('New invitation','ဖိတ်စာအသစ်'):t('Sign in','ဝင်ရောက်ရန်')}<ArrowRight size={14}/></button></div>}</section>
        :<section className="design-library"><div className="design-library-grid">{designs.map((d,index)=><article className="library-design" key={d.id}><button className="library-cover" onClick={()=>previewDesign(d.id)} aria-label={`${t('Preview design','ဒီဇိုင်းကြည့်ရန်')} ${d.name}`}>{sampleCover(d.id)}<span className="cover-open"><BookOpen size={15}/>{t('Open 3D preview','3D ကြည့်ရန်')}</span></button><div className="library-design-info"><span className="design-index">0{index+1}</span><div><h2>{d.name}</h2><p>{lang==='en'?d.description:d.description_my}</p></div><button className="icon-button" onClick={()=>previewDesign(d.id)} aria-label={`${t('Preview design','ဒီဇိုင်းကြည့်ရန်')} ${d.name}`}><ArrowUpRight size={17}/></button></div></article>)}</div><div className="library-details"><div><h2>{t('One invitation, your choice of colour','ဖိတ်စာတိုင်းတွင် စိတ်ကြိုက်အရောင်ရွေးပါ')}</h2><p>{t('Choose Sage, Midnight, Rose or Blue in the project editor. Preview before you publish.','ဖိတ်စာပြင်ဆင်သည့်နေရာတွင် Sage၊ Midnight၊ Rose သို့မဟုတ် Blue ကို ရွေးနိုင်သည်။')}</p></div><div className="library-swatches" aria-label="Sage, Midnight, Rose, Blue"><i/><i/><i/><i/></div></div><section className="project-type-registry"><h2>{t('Project types','ပရောဂျက်အမျိုးအစားများ')}</h2>{projectTypes.map(type=><div key={type.id}><span><FileText size={16}/>{lang==='en'?type.name:type.name_my}</span><span className={type.enabled?'available-type':''}>{type.enabled?t('Available','အသုံးပြုနိုင်သည်'):t('Not available yet','မရရှိသေးပါ')}</span></div>)}</section></section>}
        <footer className="workspace-footer"><span>{t('Invitation Studio','ဖိတ်စာစီမံခန့်ခွဲမှု')}</span><span><ShieldCheck size={13}/>{t('Customer information is not included in public invitations.','အပ်နှံသူအချက်အလက်များကို အများကြည့်ဖိတ်စာတွင် မထည့်ပါ။')}</span></footer>
      </main>
    </div>
    {authDialog}
    {selectedCustomer&&<dialog className="customer-dialog" aria-labelledby="customer-title" ref={node=>{if(node&&!node.open)node.showModal();}} onCancel={()=>setCustomerKey(null)}><div className="dialog-heading"><div><span className="eyebrow">{t('Customer details','အပ်နှံသူအချက်အလက်')}</span><h2 id="customer-title">{selectedCustomer[0].customer_name}</h2></div><button className="icon-button" aria-label={t('Close customer details','အပ်နှံသူအချက်အလက်ပိတ်ရန်')} onClick={()=>setCustomerKey(null)}><X size={18}/></button></div><dl><dt>{t('Email','အီးမေးလ်')}</dt><dd>{selectedCustomer[0].customer_email||'—'}</dd><dt>{t('Phone','ဖုန်း')}</dt><dd>{selectedCustomer[0].customer_phone||'—'}</dd></dl><h3>{t('Invitations','ဖိတ်စာများ')}</h3>{selectedCustomer.map(p=><div className="customer-project" key={p.id}><div><strong>{p.title}</strong><p>{p.private_notes||t('No private notes','သီးသန့်မှတ်စုမရှိပါ')}</p></div><button className="secondary small" onClick={()=>{setCustomerKey(null);setEditor(p);}}>{t('Edit','ပြင်ရန်')}<Pencil size={14}/></button></div>)}</dialog>}
    {editor&&<Editor project={editor==='new'?null:editor} lang={lang} onClose={()=>setEditor(null)} onSaved={async p=>{await refresh();setEditor(null);if(p.status==='published'&&p.public_key)setShareProjectId(p.id);setToast(p.status==='published'?t('Invitation published. Your link and heart QR are ready.','ဖိတ်စာမျှဝေပြီးပါပြီ။ လင့်ခ်နှင့် Heart QR ကို ရယူနိုင်ပါပြီ။'):t('Draft saved.','မူကြမ်းသိမ်းပြီးပါပြီ။'));}} onPreview={p=>setPreview(p)}/>}
    {shareProject&&<ShareDialog project={shareProject} lang={lang} onProjectChanged={refresh} onClose={()=>setShareProjectId(null)}/>}
    {toast&&<div className="toast" role="status"><Check size={16}/><span>{toast}</span><button aria-label={t('Dismiss notification','အကြောင်းကြားစာပိတ်ရန်')} onClick={()=>setToast('')}><X size={15}/></button></div>}
    {previewDialog}
  </div>;
}
