import { useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Check, LockKeyhole, Sparkles } from 'lucide-react';
import type { Design, Language } from '../types';
import './showcase.css';

const showcasePreviewAssets = {
  thazin: {
    src: '/assets/showcase-preview/thazin.webp',
    enAlt: 'Rendered Thazin wedding invitation with a botanical pop-up arch and Burmese couple names.',
    myAlt: 'ပန်းမုခ်ဦးနှင့် မြန်မာစုံတွဲအမည်များ ပါဝင်သော သဇင် မင်္ဂလာဖိတ်စာ နမူနာ။',
  },
  noir: {
    src: '/assets/showcase-preview/golden-vow.webp',
    enAlt: 'Rendered Golden Vow wedding invitation with an art-deco frame and a couple portrait.',
    myAlt: 'Art deco ဘောင်နှင့် စုံတွဲပုံပါဝင်သော Golden Vow မင်္ဂလာဖိတ်စာ နမူနာ။',
  },
  rose: {
    src: '/assets/showcase-preview/rose-reverie.webp',
    enAlt: 'Rendered Rose Reverie wedding invitation with layered rose paper and a couple portrait.',
    myAlt: 'အလွှာလိုက် ပန်းရောင်စက္ကူနှင့် စုံတွဲပုံပါဝင်သော Rose Reverie မင်္ဂလာဖိတ်စာ နမူနာ။',
  },
  'love-galaxy': {
    src: '/assets/showcase-preview/love-galaxy.webp',
    enAlt: 'Live Love Galaxy 3D scene with a glowing pink planet and orbiting photo memories in a star field.',
    myAlt: 'ကြယ်စင်များကြားရှိ ပန်းရောင်ဂြိုဟ်နှင့် ပတ်လည်လှည့်နေသော အမှတ်တရပုံများပါဝင်သည့် Love Galaxy 3D မြင်ကွင်း။',
  },
} as const;

type ShowcasePreviewId = keyof typeof showcasePreviewAssets;
type PreviewLoading = 'eager' | 'lazy';

export const showcaseCategories = [
  { id: 'wedding', en: 'Wedding', my: 'မင်္ဂလာ', mark: 'W', enDescription: 'Invitations for a day to remember.', myDescription: 'အမှတ်တရနေ့အတွက် ဖိတ်စာများ။' },
  { id: '3d-experiences', en: '3D Experiences', my: '3D အတွေ့အကြုံများ', mark: '3D', enDescription: 'Immersive stories made to explore.', myDescription: 'စူးစမ်းကြည့်ရှုနိုင်သော 3D အမှတ်တရများ။' },
  { id: 'event', en: 'Event', my: 'ပွဲအခမ်းအနား', mark: 'E', enDescription: 'For gatherings worth bringing people together.', myDescription: 'လူတွေကို စုစည်းပေးမယ့် အခမ်းအနားများ။' },
  { id: 'birthday', en: 'Birthday', my: 'မွေးနေ့', mark: 'B', enDescription: 'Celebrate another trip around the sun.', myDescription: 'မွေးနေ့အမှတ်တရများကို ဂုဏ်ပြုရန်။' },
  { id: 'business', en: 'Business', my: 'စီးပွားရေး', mark: 'Bu', enDescription: 'Polished designs for work and brands.', myDescription: 'လုပ်ငန်းနှင့် အမှတ်တံဆိပ်များအတွက် ဒီဇိုင်းများ။' },
  { id: 'holiday', en: 'Holiday', my: 'အားလပ်ရက်', mark: 'H', enDescription: 'Seasonal notes for the people you love.', myDescription: 'ချစ်ခင်သူများအတွက် ရာသီအလိုက် ဒီဇိုင်းများ။' },
  { id: 'others', en: 'Others', my: 'အခြားဒီဇိုင်းများ', mark: '＋', enDescription: 'A home for new kinds of ideas.', myDescription: 'အိုင်ဒီယာအသစ်များအတွက် နေရာ။' },
] as const;

export type ShowcaseCategoryId = (typeof showcaseCategories)[number]['id'];
export type CategoryFilter = ShowcaseCategoryId | 'all';

export const showcaseDesigns: { id: Design; name: string; en: string; my: string; category: ShowcaseCategoryId }[] = [
  { id: 'thazin', name: 'Thazin', en: 'Botanical · Paper book', my: 'ပန်းအလှဆင် စာအုပ်', category: 'wedding' },
  { id: 'noir', name: 'Golden Vow', en: 'Geometric · Art deco', my: 'ရွှေရောင် Art deco', category: 'wedding' },
  { id: 'rose', name: 'Rose Reverie', en: 'Floral · Layered paper', my: 'ပန်းရောင် စက္ကူပန်း', category: 'wedding' },
];

const showcaseExperiences = [
  {
    id: 'love-galaxy',
    name: 'Love Galaxy',
    category: '3d-experiences' as const,
    en: '3D memories · A 1,200-card photo orbit',
    my: '3D အမှတ်တရ · ဓာတ်ပုံကတ် ၁,၂၀၀ ပါ ဝန်းကျင်',
    href: '/love-galaxy',
  },
];

export function getShowcaseDesigns(category: CategoryFilter) {
  return category === 'all' ? showcaseDesigns : showcaseDesigns.filter(design => design.category === category);
}

type Props = { lang: Language; onLanguage: (lang: Language) => void; onPreview: (design: Design) => void; workspace?: boolean; onSignIn: () => void; checking: boolean; configured: boolean; admin?: boolean; signedIn?: boolean; onCreate: () => void };

export default function Showcase({ lang, onLanguage, onPreview, workspace, onSignIn, checking, configured, admin, signedIn, onCreate }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [failedPreviews, setFailedPreviews] = useState<Partial<Record<ShowcasePreviewId, boolean>>>({});
  const t = (en: string, my: string) => lang === 'en' ? en : my;
  const previewImage = (id: ShowcasePreviewId, loading: PreviewLoading = 'lazy', className = 'showcase-preview-image') => {
    const asset = showcasePreviewAssets[id];
    const alt = t(asset.enAlt, asset.myAlt);
    if (failedPreviews[id]) {
      return <span className={`showcase-preview-fallback ${className}`} role="img" aria-label={alt}><span>{t('Preview temporarily unavailable', 'နမူနာကို ယာယီရရှိနိုင်ခြင်းမရှိပါ')}</span></span>;
    }
    return <img className={className} src={asset.src} alt={alt} loading={loading} decoding="async" draggable={false} onError={() => setFailedPreviews(current => current[id] ? current : { ...current, [id]: true })} />;
  };
  const cover = (design: Design, loading: PreviewLoading = 'lazy') => <div className={`design-cover cover-${design}`}>{previewImage(design, loading, 'showcase-card-preview-image')}</div>;
  const currentCategory = selectedCategory === 'all' ? null : showcaseCategories.find(category => category.id === selectedCategory) ?? null;
  const visibleDesigns = getShowcaseDesigns(selectedCategory);
  const designCount = (categoryId: ShowcaseCategoryId) => showcaseDesigns.filter(design => design.category === categoryId).length;
  const categoryCount = (categoryId: ShowcaseCategoryId) => categoryId === '3d-experiences' ? showcaseExperiences.length : designCount(categoryId);
  const weddingDesignCount = designCount('wedding');
  const showExperienceCard = selectedCategory === '3d-experiences';

  return <div className="showcase">
    <a className="skip-link" href="#showcase-main">{t('Skip to content', 'အကြောင်းအရာသို့ သွားရန်')}</a>
    <header className="showcase-header">
      <a className="workspace-brand" href="/" aria-label={t('Metta Invitation Studio home', 'မေတ္တာစာ ပင်မစာမျက်နှာ')}><span className="brand-mark"><BookOpen size={19} strokeWidth={1.7}/></span><span>မေတ္တာစာ<small>Invitation Studio</small></span></a>
      <nav className="showcase-navigation" aria-label={t('Showcase navigation', 'မီနူး')}>
        <a className="showcase-nav-link" href="#categories">{t('Categories', 'အမျိုးအစားများ')}</a>
        <a className="showcase-nav-link" href="#featured">{t('Featured designs', 'ရွေးချယ်ထားသော ဒီဇိုင်းများ')}</a>
        <a className="showcase-nav-link" href="#featured" onClick={() => setSelectedCategory('3d-experiences')}>3D Experiences</a>
        <div className="language-switch" aria-label={t('Language', 'ဘာသာစကား')}><button aria-pressed={lang === 'my'} onClick={() => onLanguage('my')}>မြန်မာ</button><button aria-pressed={lang === 'en'} onClick={() => onLanguage('en')}>EN</button></div>
        <button className="secondary small showcase-header-cta" aria-label={t('Create invitation', 'ဖိတ်စာဖန်တီးမယ်')} onClick={onCreate}>{t('Create invitation', 'ဖိတ်စာဖန်တီးမယ်')}<ArrowUpRight size={14}/></button>
      </nav>
    </header>

    <main id="showcase-main" className="showcase-main">
      {workspace && <section className="showcase-access" aria-labelledby="access-title"><span className="showcase-access-icon"><LockKeyhole size={19}/></span><div><h1 id="access-title">{admin ? t('Private management', 'သီးသန့်စီမံခန့်ခွဲမှု') : t('Your invitations, your space', 'သင့်ဖိတ်စာများအတွက် သီးသန့်နေရာ')}</h1><p>{checking ? t('Checking your session…', 'အကောင့်စစ်ဆေးနေပါသည်…') : !configured ? t('Account access is not configured. You can still explore every sample below.', 'အကောင့်အသုံးပြုမှု မချိတ်ဆက်ရသေးပါ။ အောက်ပါနမူနာများကို ကြည့်ရှုနိုင်ပါသည်။') : admin && signedIn ? t('This area is restricted to the configured studio owner.', 'ဤနေရာကို သတ်မှတ်ထားသော ပိုင်ရှင်အကောင့်သာ အသုံးပြုနိုင်သည်။') : t('Only the studio owner can sign in here. Visitors can create an invitation without an account.', 'ဤနေရာကို ပိုင်ရှင်အကောင့်သာ ဝင်ရောက်နိုင်သည်။ ဧည့်သည်များက အကောင့်မလိုဘဲ ဖိတ်စာဖန်တီးနိုင်သည်။')}</p></div>{configured && !signedIn && <button className="primary" disabled={checking} onClick={onSignIn}>{t('Sign in', 'အကောင့်ဝင်ရန်')}<ArrowRight size={15}/></button>}</section>}

      <section className="showcase-hero" aria-labelledby="showcase-title">
        <div className="showcase-hero-copy">
          <span className="showcase-eyebrow"><Sparkles size={14}/>{t('A SMALL STUDIO FOR MANY KINDS OF MOMENTS', 'အမှတ်တရအမျိုးမျိုးအတွက် ဒီဇိုင်းစတူဒီယို')}</span>
          <h1 id="showcase-title">{t('Thoughtful invitations for moments worth sharing.', 'မျှဝေချင်စရာ အမှတ်တရများအတွက် ဖိတ်စာများ။')}</h1>
          <p>{t('Explore Wedding invitations and a separate 3D experience; more collections are on the way.', 'မင်္ဂလာဖိတ်စာများနှင့် သီးခြား 3D အတွေ့အကြုံကို လေ့လာပါ။ အခြားစုစည်းမှုများလည်း မကြာမီလာပါမည်။')}</p>
          <div className="showcase-hero-actions"><button className="primary" onClick={onCreate}>{t('Create your invitation', 'ဖိတ်စာဖန်တီးမယ်')}<ArrowRight size={16}/></button><a className="text-button" href="#categories">{t('Explore categories', 'အမျိုးအစားများ ကြည့်ရန်')}<ArrowRight size={15}/></a></div>
          <div className="showcase-proof"><span><Check size={14}/>{t('No account needed', 'အကောင့်မလိုပါ')}</span><i aria-hidden="true"/><span>{t('Share with one link', 'လင့်ခ်တစ်ခုဖြင့် မျှဝေပါ')}</span><i aria-hidden="true"/><span>{t('Owner space stays private', 'ပိုင်ရှင်နေရာ သီးသန့်ဖြစ်သည်')}</span></div>
        </div>
        <div className="showcase-hero-art">
          <div className="showcase-art-topline"><span>{t('A closer look', 'ဒီဇိုင်းနမူနာ')}</span><span>{t('THREE WEDDING DESIGNS', 'မင်္ဂလာဒီဇိုင်း ၃ မျိုး')}</span></div>
          <div className="showcase-art-decoration showcase-art-decoration-one" aria-hidden="true"/>
          <div className="showcase-art-decoration showcase-art-decoration-two" aria-hidden="true"/>
          <div className="showcase-art-orbit" aria-hidden="true"><span>W</span><span>+</span><span>✳</span></div>
          <button className="showcase-mini-card showcase-mini-card-noir" data-showcase-design="noir" onClick={() => onPreview('noir')} aria-label={`${t('Preview design', 'ဒီဇိုင်းနမူနာကြည့်ရန်')} Golden Vow`}>
            {cover('noir', 'eager')}<span className="showcase-mini-caption">02 <i>GOLDEN VOW</i></span>
          </button>
          <button className="showcase-mini-card showcase-mini-card-rose" data-showcase-design="rose" onClick={() => onPreview('rose')} aria-label={`${t('Preview design', 'ဒီဇိုင်းနမူနာကြည့်ရန်')} Rose Reverie`}>
            {cover('rose', 'eager')}<span className="showcase-mini-caption">03 <i>ROSE REVERIE</i></span>
          </button>
          <button className="showcase-feature-card" data-showcase-design="thazin" onClick={() => onPreview('thazin')} aria-label={`${t('Open 3D preview', '3D နမူနာကြည့်ရန်')} Thazin`}>
            {cover('thazin', 'eager')}
            <span className="showcase-feature-label">{t('Explore this design', 'ဒီဇိုင်းကို ကြည့်ရန်')}<ArrowUpRight size={14}/></span>
          </button>
          <div className="showcase-art-note"><span className="showcase-art-note-number">01</span><span><b>{t('Wedding', 'မင်္ဂလာ')}</b><small>{t(`${weddingDesignCount} designs to explore`, `ကြည့်ရှုရန် ဒီဇိုင်း ${weddingDesignCount} မျိုး`)}</small></span></div>
          <span className="showcase-art-sparkle" aria-hidden="true">✳</span>
        </div>
      </section>

      <section className="showcase-categories" id="categories" aria-labelledby="categories-title">
        <div className="showcase-section-heading">
          <div><span className="showcase-section-kicker">{t('EXPLORE THE STUDIO', 'ဒီဇိုင်းစတူဒီယိုကို လေ့လာပါ')}</span><h2 id="categories-title">{t('Browse by occasion', 'အခမ်းအနားအလိုက် ရွေးချယ်ပါ')}</h2></div>
          <p>{t('Wedding and 3D Experiences are ready to explore; Event, Birthday, Business, Holiday and Others are coming soon.', 'မင်္ဂလာနှင့် 3D အတွေ့အကြုံများကို ကြည့်ရှုနိုင်ပါပြီ။ ပွဲအခမ်းအနား၊ မွေးနေ့၊ စီးပွားရေး၊ အားလပ်ရက်နှင့် အခြားဒီဇိုင်းများ မကြာမီလာပါမည်။')}</p>
        </div>
        <div className="showcase-category-grid">
          {showcaseCategories.map((category, index) => {
            const count = categoryCount(category.id);
            const active = selectedCategory === category.id;
            return <button id={`category-${category.id}`} className={`showcase-category-card${active ? ' is-active' : ''}${count ? ' has-designs' : ''}`} key={category.id} type="button" aria-pressed={active} onClick={() => setSelectedCategory(category.id)}>
              <span className="category-card-top"><span className="category-card-index">{String(index + 1).padStart(2, '0')}</span><span className="category-card-mark" aria-hidden="true">{category.mark}</span><ArrowUpRight className="category-card-arrow" size={16}/></span>
              <span className="category-card-title">{lang === 'en' ? category.en : category.my}</span>
              <span className="category-card-description">{lang === 'en' ? category.enDescription : category.myDescription}</span>
              <span className={`category-card-status${count ? ' is-ready' : ''}`}>{count ? category.id === '3d-experiences' ? t(`${count} experience`, `အတွေ့အကြုံ ${count} မျိုး`) : t(`${count} designs`, `ဒီဇိုင်း ${count} မျိုး`) : t('Coming soon', 'မကြာမီလာမည်')}</span>
            </button>;
          })}
        </div>
      </section>

      <section className="showcase-designs" id="featured" aria-labelledby="designs-title">
        <div className="showcase-section-heading showcase-featured-heading">
          <div><span className="showcase-section-kicker">{t('FEATURED DESIGNS', 'ရွေးချယ်ထားသော ဒီဇိုင်းများ')}</span><h2 id="designs-title">{currentCategory ? (lang === 'en' ? currentCategory.en : currentCategory.my) : t('Start with a design you love', 'နှစ်သက်ရာ ဒီဇိုင်းဖြင့် စတင်ပါ')}</h2></div>
          <div className="showcase-featured-meta"><p>{currentCategory ? (lang === 'en' ? currentCategory.enDescription : currentCategory.myDescription) : t(`${weddingDesignCount} distinct wedding invitations, ready to make your own.`, `သင့်စိတ်ကြိုက် ပြင်ဆင်နိုင်သော မင်္ဂလာဖိတ်စာ ဒီဇိုင်း ${weddingDesignCount} မျိုး။`)}</p>{selectedCategory !== 'all' && <button className="showcase-reset-filter" type="button" onClick={() => setSelectedCategory('all')}>{t('Show all designs', 'ဒီဇိုင်းအားလုံးပြရန်')}<ArrowRight size={13}/></button>}</div>
        </div>
        {showExperienceCard ? <div className="design-library-grid showcase-experience-grid">{showcaseExperiences.map(experience => <article className="library-design library-design-love-galaxy" data-category={experience.category} key={experience.id}>
          <a className="library-cover experience-library-cover" href={experience.href} aria-label={t('Explore Love Galaxy 3D experience', 'Love Galaxy 3D အတွေ့အကြုံကို ကြည့်ရန်')}>
            {previewImage('love-galaxy', 'lazy', 'showcase-card-preview-image')}<span className="cover-open"><Sparkles size={14}/>{t('Explore 3D experience', '3D အတွေ့အကြုံကို ကြည့်ရန်')}<ArrowUpRight size={13}/></span><span className="showcase-design-number">3D</span>
          </a>
          <div className="library-design-info"><div className="library-design-copy"><span className="design-index">{t('3D EXPERIENCES · FEATURED', '3D အတွေ့အကြုံ · ရွေးချယ်ထားသည်')}</span><h3>{experience.name}</h3><p>{lang === 'en' ? experience.en : experience.my}</p></div><a className="icon-button library-design-arrow" href={experience.href} aria-label={t('Open Love Galaxy', 'Love Galaxy ဖွင့်ရန်')}><ArrowUpRight size={18}/></a></div>
        </article>)}</div> : visibleDesigns.length > 0 ? <div className="design-library-grid">{visibleDesigns.map((design, index) => <article className={`library-design library-design-${design.id}`} data-category={design.category} key={design.id}>
          <button className="library-cover" onClick={() => onPreview(design.id)} aria-label={`${t('Preview design', 'ဒီဇိုင်းကြည့်ရန်')} ${design.name}`}>{cover(design.id)}<span className="cover-open"><BookOpen size={14}/>{t('Open 3D preview', '3D ကြည့်ရန်')}<ArrowUpRight size={13}/></span><span className="showcase-design-number">0{index + 1}</span></button>
          <div className="library-design-info"><div className="library-design-copy"><span className="design-index">{t('WEDDING · DESIGN', 'မင်္ဂလာ · ဒီဇိုင်း')} 0{index + 1}</span><h3>{design.name}</h3><p>{lang === 'en' ? design.en : design.my}</p></div><button className="icon-button library-design-arrow" onClick={() => onPreview(design.id)} aria-label={`${t('Open sample', 'နမူနာဖွင့်ရန်')} ${design.name}`}><ArrowUpRight size={18}/></button></div>
        </article>)}</div> : currentCategory && <div className="showcase-empty-state" aria-live="polite">
          <span className="empty-state-mark" aria-hidden="true">{currentCategory.mark}</span><span className="showcase-section-kicker">{t('A NEW COLLECTION IS TAKING SHAPE', 'စုစည်းမှုအသစ်ကို ပြင်ဆင်နေပါသည်')}</span>
          <h3>{lang === 'en' ? `${currentCategory.en} designs are coming soon` : `${currentCategory.my} ဒီဇိုင်းများ မကြာမီလာမည်`}</h3>
          <p>{t('There are no templates in this category yet. In the meantime, explore the wedding designs already in the studio.', 'ဤအမျိုးအစားအတွက် ဒီဇိုင်းများ မရှိသေးပါ။ လက်ရှိရရှိနိုင်သော မင်္ဂလာဖိတ်စာများကို ကြည့်ရှုနိုင်ပါသည်။')}</p>
          <button type="button" className="empty-state-link" onClick={() => setSelectedCategory('wedding')}>{t('Explore wedding designs', 'မင်္ဂလာဖိတ်စာများ ကြည့်ရန်')}<ArrowRight size={15}/></button>
        </div>}
      </section>

      {selectedCategory === 'all' && <section className="showcase-love-galaxy" id="love-galaxy" aria-labelledby="showcase-galaxy-title">
        <div className="showcase-galaxy-copy">
          <span className="showcase-galaxy-eyebrow">{t('A SEPARATE 3D MEMORY EXPERIENCE', 'သီးခြား 3D အမှတ်တရ အတွေ့အကြုံ')}</span>
          <h2 id="showcase-galaxy-title">Love Galaxy</h2>
          <p>{t('Turn four favorite photos into a 1,200-card orbit through the stars, with your own soundtrack. This is a separate creation and sharing experience—not a wedding invitation template.', 'နှစ်သက်ရာ ဓာတ်ပုံလေးပုံမှ ကတ် ၁,၂၀၀ ပါ ကြယ်စင်ဝန်းကျင် 3D အမှတ်တရကမ္ဘာ ဖန်တီးပြီး ကိုယ်ပိုင်တေးသံဖြင့် မျှဝေလိုက်ပါ။ ဤအရာသည် မင်္ဂလာဖိတ်စာ template မဟုတ်ဘဲ သီးခြားဖန်တီးမျှဝေမှု အတွေ့အကြုံဖြစ်သည်။')}</p>
          <div className="showcase-galaxy-actions">
            <a className="showcase-galaxy-primary" href="/love-galaxy">{t('Explore Love Galaxy', 'Love Galaxy ကို ကြည့်ရန်')}<ArrowUpRight size={15}/></a>
            <a className="showcase-galaxy-secondary" href="/love-galaxy/create">{t('Create your own', 'ကိုယ်ပိုင် ဖန်တီးရန်')}<ArrowRight size={15}/></a>
          </div>
        </div>
        <div className="showcase-galaxy-art">{previewImage('love-galaxy', 'lazy', 'showcase-galaxy-preview-image')}</div>
      </section>}

      <section className="showcase-how" aria-labelledby="showcase-how-title"><div className="showcase-how-heading"><span className="showcase-section-kicker">{t('SIMPLE BY DESIGN', 'ရိုးရှင်းစွာ ဖန်တီးထားသည်')}</span><h2 id="showcase-how-title">{t('Choose. Customize. Share.', 'ရွေးချယ်ပါ။ ပြင်ဆင်ပါ။ မျှဝေပါ။')}</h2><p>{t('A lovely design is only the beginning. Make it yours, then send it on its way.', 'လှပသော ဒီဇိုင်းတစ်ခုမှ စတင်ပါ။ သင့်စိတ်ကြိုက် ပြင်ဆင်ပြီး မျှဝေလိုက်ပါ။')}</p></div><div className="showcase-steps"><div><span className="showcase-step-number">01</span><h3>{t('Choose', 'ရွေးချယ်ပါ')}</h3><p>{t('Open the samples and choose a style that feels right.', 'နမူနာများထဲမှ သင့်စိတ်ကြိုက် ဒီဇိုင်းကို ရွေးပါ။')}</p></div><div><span className="showcase-step-number">02</span><h3>{t('Customize', 'ပြင်ဆင်ပါ')}</h3><p>{t('Add your event details and photos—no account needed.', 'ပွဲအချက်အလက်နှင့် ဓာတ်ပုံများ ထည့်ပါ။ အကောင့်မလိုပါ။')}</p></div><div><span className="showcase-step-number">03</span><h3>{t('Share', 'မျှဝေပါ')}</h3><p>{t('Get a share link and Heart QR. Keep the link—there is no account or edit link.', 'မျှဝေရန် လင့်ခ်နှင့် Heart QR ရယူပါ။ လင့်ခ်ကို သိမ်းထားပါ။ အကောင့်နှင့် ပြန်ပြင်ရန်လင့်ခ် မရှိပါ။')}</p></div></div></section>
    </main>

    <footer className="showcase-footer"><div className="showcase-footer-brand"><a href="/" aria-label={t('Metta Invitation Studio home', 'မေတ္တာစာ ပင်မစာမျက်နှာ')}><span>မေတ္တာစာ</span><i>·</i><span>Invitation Studio</span></a><small>{t('Thoughtful designs, made to be shared.', 'မျှဝေဖို့ ဖန်တီးထားသော ဒီဇိုင်းများ။')}</small></div><div className="showcase-footer-explore"><span>{t('EXPLORE', 'လေ့လာရန်')}</span><nav aria-label={t('Browse categories', 'အမျိုးအစားများ ကြည့်ရန်')}>{showcaseCategories.map(category => <a href="#featured" key={category.id} onClick={() => setSelectedCategory(category.id)}>{lang === 'en' ? category.en : category.my}</a>)}</nav></div><div className="showcase-footer-utility"><a href="#featured" onClick={() => setSelectedCategory('3d-experiences')}>Love Galaxy<ArrowUpRight size={13}/></a><a href="/manage"><LockKeyhole size={13}/>{t('Private management', 'သီးသန့်စီမံခန့်ခွဲမှု')}</a><button type="button" onClick={onCreate}>{t('Create an invitation', 'ဖိတ်စာဖန်တီးမယ်')}<ArrowRight size={13}/></button></div></footer>
  </div>;
}
