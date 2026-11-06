import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Check, ChevronLeft, ChevronRight, Heart, LockKeyhole, MessageCircle, Pause, Play, Sparkles } from 'lucide-react';
import type { Design, Language } from '../types';
import { INVITATION_TEMPLATES } from '../templates/registry';
import './showcase.css';

const invitationPreviewAssets = Object.fromEntries(
  INVITATION_TEMPLATES.map(({ id, preview }) => [id, preview]),
) as Record<Design, (typeof INVITATION_TEMPLATES)[number]['preview']>;

export const showcasePreviewAssets = {
  ...invitationPreviewAssets,
  'love-galaxy': {
    src: '/assets/showcase-preview/love-galaxy-shared-journey.webp',
    enAlt: 'Current shared-journey sample at arrival, with photo memories and an in-scene neighboring-planet label.',
    myAlt: 'မျှဝေခရီးလမ်းအဆုံးတွင် အမှတ်တရဓာတ်ပုံများနှင့် ရွေးချယ်နိုင်သော အနီးအနားဂြိုဟ်အမည် ပါဝင်သည့် လက်ရှိသုံးဖက်မြင်နမူနာ။',
  },
} as const;

type ShowcasePreviewId = Design | 'love-galaxy';
type PreviewLoading = 'eager' | 'lazy';
export type ShowcaseFeaturedProject = {
  id: string;
  nameEn: string;
  nameMy: string;
  titleEn: string;
  titleMy: string;
  eyebrowEn: string;
  eyebrowMy: string;
  descriptionEn: string;
  descriptionMy: string;
  highlights: readonly { en: string; my: string }[];
  actionEn: string;
  actionMy: string;
  secondaryAction?: { labelEn: string; labelMy: string } & (
    | { kind: 'link'; href: string }
    | { kind: 'create-invitation' }
  );
  href: string;
  previewIds: readonly ShowcasePreviewId[];
  theme: 'invitation' | 'galaxy';
};

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

export const showcaseDesigns = INVITATION_TEMPLATES.map(({ id, name, descriptionEn, descriptionMy }) => ({
  id, name, en: descriptionEn, my: descriptionMy, category: 'wedding' as const,
}));

// Keep the review journey on this preview build instead of the production build where its flag is off.
const loveGalaxyReviewPreviewUrl = '/love-galaxy?review=shared-journey&sample=1';

export const showcaseFeaturedProjects: readonly ShowcaseFeaturedProject[] = [
  {
    id: 'invitations',
    nameEn: 'Invitation Project',
    nameMy: 'ဖိတ်စာပရောဂျက်',
    titleEn: 'Thoughtful invitations for moments worth sharing.',
    titleMy: 'မျှဝေချင်စရာ အမှတ်တရများအတွက် ဖိတ်စာများ။',
    eyebrowEn: 'INVITATION PROJECT · WEDDING COLLECTION',
    eyebrowMy: 'ဖိတ်စာပရောဂျက် · မင်္ဂလာဖိတ်စာများ',
    descriptionEn: 'Explore our wedding invitation collection, add your event details and photos, then share your finished design with one simple link—no account needed.',
    descriptionMy: 'မင်္ဂလာဖိတ်စာဒီဇိုင်းများကို ကြည့်ရှုပြီး ပွဲအချက်အလက်နှင့် ဓာတ်ပုံများကို စိတ်ကြိုက်ထည့်ပါ။ ပြီးလျှင် အကောင့်ဖွင့်စရာမလိုဘဲ လင့်ခ်တစ်ခုတည်းဖြင့် မျှဝေနိုင်ပါသည်။',
    highlights: [
      { en: '3 ready-to-personalize designs', my: 'စိတ်ကြိုက်ပြင်ဆင်နိုင်သော ဒီဇိုင်း ၃ မျိုး' },
      { en: 'No account needed', my: 'အကောင့်မလိုပါ' },
      { en: 'Share with one link', my: 'လင့်ခ်တစ်ခုဖြင့် မျှဝေပါ' },
    ],
    actionEn: 'Explore invitations',
    actionMy: 'ဖိတ်စာများ ကြည့်ရန်',
    secondaryAction: { kind: 'create-invitation', labelEn: 'Create your invitation', labelMy: 'ဖိတ်စာဖန်တီးမယ်' },
    href: '#featured',
    previewIds: INVITATION_TEMPLATES.map(({ id }) => id),
    theme: 'invitation',
  },
  {
    id: 'love-galaxy',
    nameEn: 'Love Galaxy',
    nameMy: 'Love Galaxy',
    titleEn: 'A universe of memories, made for you.',
    titleMy: 'သင့်အမှတ်တရများအတွက် ကိုယ်ပိုင်ကြယ်စင်ကမ္ဘာ။',
    eyebrowEn: 'LOVE GALAXY · SEPARATE 3D EXPERIENCE',
    eyebrowMy: 'LOVE GALAXY · သီးခြား 3D အတွေ့အကြုံ',
    descriptionEn: 'Turn four favorite photos into a 1,200-card orbit through the stars. Add your own soundtrack and explore a 3D memory world built around your story.',
    descriptionMy: 'နှစ်သက်ရာ ဓာတ်ပုံ ၄ ပုံကို ကြယ်စင်များကြား လှည့်ပတ်နေသော အမှတ်တရကတ် ၁,၂၀၀ အဖြစ် ဖန်တီးပါ။ ကိုယ်ပိုင်တေးသံထည့်ပြီး သင့်ဇာတ်လမ်းအတွက် 3D အမှတ်တရကမ္ဘာကို စူးစမ်းလိုက်ပါ။',
    highlights: [
      { en: 'Four favorite photos', my: 'နှစ်သက်ရာ ဓာတ်ပုံ ၄ ပုံ' },
      { en: 'Personal soundtrack', my: 'ကိုယ်ပိုင်တေးသံ' },
      { en: 'Explore in 3D', my: '3D ဖြင့် စူးစမ်းပါ' },
    ],
    actionEn: 'Explore Love Galaxy',
    actionMy: 'Love Galaxy ကို ကြည့်ရန်',
    secondaryAction: { kind: 'link', href: '/love-galaxy/create', labelEn: 'Create your own', labelMy: 'ကိုယ်ပိုင် ဖန်တီးရန်' },
    href: loveGalaxyReviewPreviewUrl,
    previewIds: ['love-galaxy'],
    theme: 'galaxy',
  },
];

const showcaseExperiences = [
  {
    id: 'love-galaxy',
    name: 'Love Galaxy',
    category: '3d-experiences' as const,
    en: '3D memories · A 1,200-card photo orbit',
    my: '3D အမှတ်တရ · ဓာတ်ပုံကတ် ၁,၂၀၀ ပါ ဝန်းကျင်',
    href: loveGalaxyReviewPreviewUrl,
  },
];

export const showcaseFaqs: Record<Language, readonly { question: string; answer: string }[]> = {
  en: [
    { question: 'Can I create an invitation without an account?', answer: 'Yes. Guests can create and publish a wedding invitation without signing up. Keep the share link: anyone who has it can view the invitation.' },
    { question: 'How many invitation templates are available?', answer: 'There are three wedding designs: Thazin, Golden Vow and Rose Reverie. Love Galaxy is a separate 3D experience.' },
    { question: 'Can I edit a guest invitation after publishing?', answer: 'Guest invitations do not have a saved draft or an edit link. Review the details before publishing and keep the share link.' },
    { question: 'Which photos can I upload?', answer: 'Add up to three JPG, PNG or WEBP photos. Each photo can be up to 4.49 MB.' },
    { question: 'How many unique people use the studio?', answer: 'We do not have a reliable unique-user total. Guests do not need accounts, and the studio does not identify individual guest creators for counting.' },
    { question: 'What do I receive when I publish?', answer: 'You receive a share link and a matching Heart QR. Anyone with the link can open the published invitation.' },
  ],
  my: [
    { question: 'အကောင့်မဖွင့်ဘဲ ဖိတ်စာဖန်တီးနိုင်ပါသလား။', answer: 'ရပါတယ်။ ဧည့်သည်များသည် အကောင့်မဖွင့်ဘဲ မင်္ဂလာဖိတ်စာဖန်တီးပြီး မျှဝေနိုင်ပါသည်။ မျှဝေရန်လင့်ခ်ကို သိမ်းထားပါ—လင့်ခ်ရသူတိုင်း ဖိတ်စာကို ကြည့်နိုင်ပါသည်။' },
    { question: 'လက်ရှိ ဖိတ်စာဒီဇိုင်း ဘယ်နှမျိုးရှိပါသလဲ။', answer: 'လက်ရှိ မင်္ဂလာဖိတ်စာဒီဇိုင်း ၃ မျိုးရှိပါသည်—Thazin၊ Golden Vow နှင့် Rose Reverie။ Love Galaxy သည် သီးခြား 3D အတွေ့အကြုံဖြစ်သည်။' },
    { question: 'မျှဝေပြီးနောက် ဧည့်သည်ဖန်တီးထားသော ဖိတ်စာကို ပြန်ပြင်နိုင်ပါသလား။', answer: 'ဧည့်သည်ဖန်တီးသော ဖိတ်စာတွင် သိမ်းထားသော မူကြမ်း သို့မဟုတ် ပြန်ပြင်ရန်လင့်ခ် မရှိပါ။ မျှဝေမီ အချက်အလက်များကို စစ်ဆေးပြီး လင့်ခ်ကို သိမ်းထားပါ။' },
    { question: 'ဘယ်လိုဓာတ်ပုံတွေ တင်နိုင်ပါသလဲ။', answer: 'JPG၊ PNG သို့မဟုတ် WEBP ဓာတ်ပုံ ၃ ပုံအထိ တင်နိုင်ပြီး တစ်ပုံလျှင် 4.49 MB အထိ ရပါသည်။' },
    { question: 'စတူဒီယိုကို သီးခြားအသုံးပြုသူ ဘယ်နှဦး သုံးနေပါသလဲ။', answer: 'သီးခြားအသုံးပြုသူအရေအတွက်ကို အတည်ပြုနိုင်သည့် စာရင်းမရှိပါ။ ဧည့်သည်များ အကောင့်မဖွင့်ရသည့်အပြင် တစ်ဦးချင်းအသုံးပြုသူကို ခွဲခြားရေတွက်ရန်လည်း စနစ်က မသတ်မှတ်ထားပါ။' },
    { question: 'ဖိတ်စာမျှဝေသောအခါ ဘာရရှိပါသလဲ။', answer: 'မျှဝေရန်လင့်ခ်နှင့် ၎င်းနှင့်ကိုက်ညီသော Heart QR ကို ရရှိပါသည်။ လင့်ခ်ရသူတိုင်း မျှဝေထားသောဖိတ်စာကို ဖွင့်ကြည့်နိုင်ပါသည်။' },
  ],
};

export const showcaseDemoReviews: Record<Language, readonly { quote: string }[]> = {
  en: [
    { quote: 'Event details and favorite photos come together in one invitation. Previewing the layout before sharing makes it easier to picture the day, and the finished design is ready to send with one simple link.' },
    { quote: 'Choosing a style, adding event details and photos, then reviewing the finished invitation all feel straightforward. Everything stays together in one place before the share link is ready.' },
    { quote: 'Seeing the invitation preview before sharing makes it easier to imagine the final design. The names, event date and photos are easy to review together, then the finished invitation can be shared with one link.' },
  ],
  my: [
    { quote: 'ပွဲအချက်အလက်နဲ့ ဓာတ်ပုံတွေကို ဖိတ်စာတစ်ခုထဲမှာ စုစည်းပြီး လင့်ခ်တစ်ခုတည်းနဲ့ မျှဝေနိုင်တာ အဆင်ပြေတယ်။ မျှဝေမီ နမူနာကို ကြည့်ပြီး စာသားနဲ့ ဒီဇိုင်းပုံစံကို တစ်နေရာတည်းမှာ စစ်ဆေးနိုင်တာလည်း သဘောကျတယ်။' },
    { quote: 'ဒီဇိုင်းရွေးပြီး ကိုယ်ပိုင်အချက်အလက်တွေ ထည့်ပြင်ဆင်တာ ရိုးရှင်းတယ်။ ပွဲရက်၊ နေရာနဲ့ ဓာတ်ပုံတွေကို တစ်နေရာတည်းမှာ စီစဉ်ပြီး နောက်ဆုံးနမူနာကို ကြည့်နိုင်တယ်။ ပြီးသွားရင် ဧည့်သည်တွေဆီ လင့်ခ်တစ်ခု ပို့ရုံပါပဲ။' },
    { quote: 'ဖိတ်စာကို မမျှဝေမီ နမူနာကြည့်နိုင်တာက ကိုယ်လိုချင်တဲ့ပုံစံကို စဉ်းစားရလွယ်စေတယ်။ အမည်၊ ပွဲနေ့နဲ့ ဓာတ်ပုံတွေကို တစ်ခါတည်း စစ်ဆေးနိုင်သလို ပြီးသွားရင် လင့်ခ်တစ်ခုနဲ့ မျှဝေနိုင်တာလည်း အဆင်ပြေတယ်။' },
  ],
};

export function getShowcaseDesigns(category: CategoryFilter) {
  return category === 'all' ? showcaseDesigns : showcaseDesigns.filter(design => design.category === category);
}

type Props = { lang: Language; onLanguage: (lang: Language) => void; onPreview: (design: Design) => void; workspace?: boolean; onSignIn: () => void; checking: boolean; configured: boolean; admin?: boolean; signedIn?: boolean; onCreate: () => void };

export default function Showcase({ lang, onLanguage, onPreview, workspace, onSignIn, checking, configured, admin, signedIn, onCreate }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [failedPreviews, setFailedPreviews] = useState<Partial<Record<ShowcasePreviewId, boolean>>>({});
  const [featuredProjectIndex, setFeaturedProjectIndex] = useState(0);
  const [featuredRotationPaused, setFeaturedRotationPaused] = useState(false);
  const [featuredPointerInside, setFeaturedPointerInside] = useState(false);
  const [featuredHasFocus, setFeaturedHasFocus] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
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
  const featuredProjectCount = showcaseFeaturedProjects.length;
  const activeFeaturedProject = showcaseFeaturedProjects[featuredProjectIndex];

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener('change', updatePreference);
    return () => preference.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (featuredProjectCount < 2 || featuredRotationPaused || featuredPointerInside || featuredHasFocus || prefersReducedMotion) return;
    const timer = window.setInterval(() => setFeaturedProjectIndex(current => (current + 1) % featuredProjectCount), 6500);
    return () => window.clearInterval(timer);
  }, [featuredProjectCount, featuredRotationPaused, featuredPointerInside, featuredHasFocus, prefersReducedMotion]);

  const moveFeaturedProject = (direction: number) => setFeaturedProjectIndex(current => (current + direction + featuredProjectCount) % featuredProjectCount);

  return <div className="showcase">
    <a className="skip-link" href="#showcase-main">{t('Skip to content', 'အကြောင်းအရာသို့ သွားရန်')}</a>
    <header className="showcase-header">
      <a className="workspace-brand" href="/" aria-label="Toewaioo's Studio home"><span className="brand-mark"><BookOpen size={19} strokeWidth={1.7}/></span><span>Toewaioo's Studio</span></a>
      <nav className="showcase-navigation" aria-label={t('Showcase navigation', 'မီနူး')}>
        <a className="showcase-nav-link" href="#categories">{t('Categories', 'အမျိုးအစားများ')}</a>
        <a className="showcase-nav-link" href="#featured">{t('Featured designs', 'ရွေးချယ်ထားသော ဒီဇိုင်းများ')}</a>
        <a className="showcase-nav-link" href="#featured" onClick={() => setSelectedCategory('3d-experiences')}>3D Experiences</a>
        <a className="showcase-nav-link" href="#reviews">{t('User reviews', 'နမူနာသုံးသပ်ချက်များ')}</a>
        <a className="showcase-nav-link" href="#faq">{t('FAQ', 'မေးလေ့ရှိသော မေးခွန်းများ')}</a>
        <div className="language-switch" aria-label={t('Language', 'ဘာသာစကား')}><button aria-pressed={lang === 'my'} onClick={() => onLanguage('my')}>မြန်မာ</button><button aria-pressed={lang === 'en'} onClick={() => onLanguage('en')}>EN</button></div>
        <button className="secondary small showcase-header-cta" aria-label={t('Create invitation', 'ဖိတ်စာဖန်တီးမယ်')} onClick={onCreate}>{t('Create invitation', 'ဖိတ်စာဖန်တီးမယ်')}<ArrowUpRight size={14}/></button>
      </nav>
    </header>

    <main id="showcase-main" className="showcase-main">
      {workspace && <section className="showcase-access" aria-labelledby="access-title"><span className="showcase-access-icon"><LockKeyhole size={19}/></span><div><h1 id="access-title">{admin ? t('Private management', 'သီးသန့်စီမံခန့်ခွဲမှု') : t('Your invitations, your space', 'သင့်ဖိတ်စာများအတွက် သီးသန့်နေရာ')}</h1><p>{checking ? t('Checking your session…', 'အကောင့်စစ်ဆေးနေပါသည်…') : !configured ? t('Account access is not configured. You can still explore every sample below.', 'အကောင့်အသုံးပြုမှု မချိတ်ဆက်ရသေးပါ။ အောက်ပါနမူနာများကို ကြည့်ရှုနိုင်ပါသည်။') : admin && signedIn ? t('This area is restricted to the configured studio owner.', 'ဤနေရာကို သတ်မှတ်ထားသော ပိုင်ရှင်အကောင့်သာ အသုံးပြုနိုင်သည်။') : t('Only the studio owner can sign in here. Visitors can create an invitation without an account.', 'ဤနေရာကို ပိုင်ရှင်အကောင့်သာ ဝင်ရောက်နိုင်သည်။ ဧည့်သည်များက အကောင့်မလိုဘဲ ဖိတ်စာဖန်တီးနိုင်သည်။')}</p></div>{configured && !signedIn && <button className="primary" disabled={checking} onClick={onSignIn}>{t('Sign in', 'အကောင့်ဝင်ရန်')}<ArrowRight size={15}/></button>}</section>}

      <section
        className="showcase-hero"
        id="hero-featured-projects"
        aria-labelledby="showcase-title"
        aria-roledescription={t('carousel', 'အလိုအလျောက်ပြောင်းလဲပြသမှု')}
        onMouseEnter={() => setFeaturedPointerInside(true)}
        onMouseLeave={() => setFeaturedPointerInside(false)}
        onFocusCapture={() => setFeaturedHasFocus(true)}
        onBlurCapture={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFeaturedHasFocus(false);
        }}
      >
        {activeFeaturedProject && <article
          className={`showcase-hero-project-slide showcase-project-slide-${activeFeaturedProject.theme}`}
          data-featured-project={activeFeaturedProject.id}
          aria-roledescription={t('slide', 'ပရောဂျက်')}
          aria-label={`${featuredProjectIndex + 1} ${t('of', 'မှ')} ${featuredProjectCount}`}
          aria-live={featuredRotationPaused || featuredPointerInside || featuredHasFocus || prefersReducedMotion ? 'polite' : 'off'}
        >
          <div className="showcase-hero-copy">
            <span className="showcase-eyebrow"><Sparkles size={14}/>{t(activeFeaturedProject.eyebrowEn, activeFeaturedProject.eyebrowMy)}</span>
            <h1 id="showcase-title">{t(activeFeaturedProject.titleEn, activeFeaturedProject.titleMy)}</h1>
            <p>{t(activeFeaturedProject.descriptionEn, activeFeaturedProject.descriptionMy)}</p>
            <ul className="showcase-hero-highlights" aria-label={t('Project highlights', 'ပရောဂျက်၏ အဓိကအချက်များ')}>
              {activeFeaturedProject.highlights.map(highlight => <li key={highlight.en}><Check size={13} aria-hidden="true"/>{t(highlight.en, highlight.my)}</li>)}
            </ul>
            <div className="showcase-hero-actions">
              <a className="primary" href={activeFeaturedProject.href}>{t(activeFeaturedProject.actionEn, activeFeaturedProject.actionMy)}<ArrowRight size={16}/></a>
              {activeFeaturedProject.secondaryAction?.kind === 'create-invitation' && <button type="button" className="text-button" onClick={onCreate}>{t(activeFeaturedProject.secondaryAction.labelEn, activeFeaturedProject.secondaryAction.labelMy)}<ArrowRight size={15}/></button>}
              {activeFeaturedProject.secondaryAction?.kind === 'link' && <a className="text-button" href={activeFeaturedProject.secondaryAction.href}>{t(activeFeaturedProject.secondaryAction.labelEn, activeFeaturedProject.secondaryAction.labelMy)}<ArrowRight size={15}/></a>}
            </div>
          </div>
          <div className="showcase-hero-projects">
            <div className="showcase-hero-projects-top">
              <span className="showcase-hero-projects-label">{t('STUDIO PROJECTS', 'စတူဒီယို၏ လက်ရာများ')}</span>
              <div className="showcase-project-carousel-controls">
                <button type="button" aria-label={t('Show previous project', 'ယခင်ပရောဂျက် ပြရန်')} onClick={() => moveFeaturedProject(-1)}><ChevronLeft size={17}/></button>
                <button type="button" aria-label={featuredRotationPaused ? t('Resume automatic project rotation', 'အလိုအလျောက်ပြသမှု ပြန်စရန်') : t('Pause automatic project rotation', 'အလိုအလျောက်ပြသမှု ခဏရပ်ရန်')} aria-pressed={featuredRotationPaused} onClick={() => setFeaturedRotationPaused(current => !current)}>{featuredRotationPaused ? <Play size={14}/> : <Pause size={14}/>}</button>
                <button type="button" aria-label={t('Show next project', 'နောက်ပရောဂျက် ပြရန်')} onClick={() => moveFeaturedProject(1)}><ChevronRight size={17}/></button>
              </div>
            </div>
            <a className={`showcase-hero-project-visual showcase-hero-project-visual-${activeFeaturedProject.theme}`} href={activeFeaturedProject.href} aria-label={t(activeFeaturedProject.actionEn, activeFeaturedProject.actionMy)}>
              <div className={`showcase-project-images showcase-project-images-${activeFeaturedProject.previewIds.length}`} aria-hidden="true">
                {activeFeaturedProject.previewIds.map(previewId => <div className="showcase-project-image-frame" key={previewId}>{previewImage(previewId, 'eager', 'showcase-project-image')}</div>)}
              </div>
              <span className="showcase-project-art-label">{String(featuredProjectIndex + 1).padStart(2, '0')} <i>/</i> {String(featuredProjectCount).padStart(2, '0')}</span>
            </a>
            <div className="showcase-hero-projects-footer">
              <div className="showcase-project-pagination" role="group" aria-label={t('Choose a project', 'ပရောဂျက်ရွေးရန်')}>
                {showcaseFeaturedProjects.map((project, index) => <button
                  type="button"
                  key={project.id}
                  aria-label={`${t('Show project', 'ပရောဂျက်ပြရန်')} ${t(project.nameEn, project.nameMy)}`}
                  aria-pressed={featuredProjectIndex === index}
                  onClick={() => setFeaturedProjectIndex(index)}
                ><span/></button>)}
              </div>
              <span className="showcase-project-carousel-status" aria-hidden="true">{String(featuredProjectIndex + 1).padStart(2, '0')} <i>/</i> {String(featuredProjectCount).padStart(2, '0')}</span>
            </div>
          </div>
        </article>}
      </section>

      <section className="showcase-facts" aria-labelledby="showcase-facts-title">
        <div className="showcase-facts-heading">
          <div><span className="showcase-section-kicker">{t('THE STUDIO, BY THE NUMBERS', 'စတူဒီယို၏ အချက်အလက်များ')}</span><h2 id="showcase-facts-title">{t('A clear picture of what is here', 'လက်ရှိရရှိနိုင်သည့် အချက်အလက်များ')}</h2></div>
          <p>{t('We show verified offerings, not estimated audience numbers.', 'အတည်ပြုနိုင်သော အချက်အလက်များကိုသာ ဖော်ပြပြီး ခန့်မှန်းအသုံးပြုသူအရေအတွက်ကို မထည့်ပါ။')}</p>
        </div>
        <dl className="showcase-facts-list">
          <div className="showcase-fact"><dt>{t('3D experiences', '3D အတွေ့အကြုံများ')}</dt><dd><strong>{showcaseExperiences.length.toLocaleString(lang === 'my' ? 'my-MM' : 'en')}</strong><span>{t('experience available', 'အတွေ့အကြုံ ရရှိနိုင်သည်')}</span><small>{t('Love Galaxy is a separate experience', 'Love Galaxy သည် သီးခြားအတွေ့အကြုံဖြစ်သည်')}</small></dd></div>
          <div className="showcase-fact"><dt>{t('Unique user total', 'သီးခြားအသုံးပြုသူအရေအတွက်')}</dt><dd><strong className="showcase-fact-untracked">{t('Not tracked', 'မမှတ်တမ်းတင်ထားပါ')}</strong><small>{t('Guests can create without an account, so a reliable unique-user count is not available.', 'ဧည့်သည်များ အကောင့်မဖွင့်ဘဲ ဖန်တီးနိုင်သောကြောင့် သီးခြားအသုံးပြုသူအရေအတွက်ကို အတည်ပြုမရပါ။')}</small></dd></div>
        </dl>
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

      <section className="showcase-how" aria-labelledby="showcase-how-title"><div className="showcase-how-heading"><span className="showcase-section-kicker">{t('SIMPLE BY DESIGN', 'ရိုးရှင်းစွာ ဖန်တီးထားသည်')}</span><h2 id="showcase-how-title">{t('Choose. Customize. Share.', 'ရွေးချယ်ပါ။ ပြင်ဆင်ပါ။ မျှဝေပါ။')}</h2><p>{t('A lovely design is only the beginning. Make it yours, then send it on its way.', 'လှပသော ဒီဇိုင်းတစ်ခုမှ စတင်ပါ။ သင့်စိတ်ကြိုက် ပြင်ဆင်ပြီး မျှဝေလိုက်ပါ။')}</p></div><div className="showcase-steps"><div><span className="showcase-step-number">01</span><h3>{t('Choose', 'ရွေးချယ်ပါ')}</h3><p>{t('Open the samples and choose a style that feels right.', 'နမူနာများထဲမှ သင့်စိတ်ကြိုက် ဒီဇိုင်းကို ရွေးပါ။')}</p></div><div><span className="showcase-step-number">02</span><h3>{t('Customize', 'ပြင်ဆင်ပါ')}</h3><p>{t('Add your event details and photos—no account needed.', 'ပွဲအချက်အလက်နှင့် ဓာတ်ပုံများ ထည့်ပါ။ အကောင့်မလိုပါ။')}</p></div><div><span className="showcase-step-number">03</span><h3>{t('Share', 'မျှဝေပါ')}</h3><p>{t('Get a share link and Heart QR. Keep the link—there is no account or edit link.', 'မျှဝေရန် လင့်ခ်နှင့် Heart QR ရယူပါ။ လင့်ခ်ကို သိမ်းထားပါ။ အကောင့်နှင့် ပြန်ပြင်ရန်လင့်ခ် မရှိပါ။')}</p></div></div></section>

      <section className="showcase-reviews" id="reviews" aria-labelledby="showcase-reviews-title">
        <div className="showcase-reviews-heading">
          <span className="showcase-section-kicker">{t('SAMPLE REVIEWS · DEMO COPY', 'နမူနာသုံးသပ်ချက်များ · သရုပ်ပြစာသား')}</span>
          <h2 id="showcase-reviews-title">{t('A few kind words, as a sample', 'သုံးသပ်ချက် နမူနာများ')}<MessageCircle aria-hidden="true" size={28} strokeWidth={1.7}/></h2>
          <p>{t('Every card below is fictional demo copy for layout preview—not a real customer review, rating or verified user.', 'အောက်ပါကတ်အားလုံးသည် ဒီဇိုင်းပြသရန် ဖန်တီးထားသော စိတ်ကူးယဉ်နမူနာစာသားများသာ ဖြစ်ပြီး တကယ့်ဖောက်သည်သုံးသပ်ချက်၊ အဆင့်သတ်မှတ်ချက် သို့မဟုတ် အတည်ပြုအသုံးပြုသူ မဟုတ်ပါ။')}</p>
        </div>
        <div className="showcase-review-grid" role="region" aria-label={t('Sample review cards; scroll horizontally to browse', 'နမူနာသုံးသပ်ချက်ကတ်များ၊ ဘေးတိုက်ရွှေ့၍ ကြည့်နိုင်သည်')} tabIndex={0}>{showcaseDemoReviews[lang].map((review, index) => <article className="showcase-review" data-demo-review="true" key={`demo-review-${index}`}>
          <div className="showcase-review-hearts" role="img" aria-label={t('Decorative demo hearts only; not a real user rating', 'အလှဆင်သရုပ်ပြနှလုံးပုံများသာဖြစ်ပြီး တကယ့်အသုံးပြုသူအဆင့်သတ်မှတ်ချက် မဟုတ်ပါ')}>{Array.from({ length: 5 }, (_, heartIndex) => <Heart key={heartIndex} aria-hidden="true" size={20} fill="currentColor" strokeWidth={1.5}/>)}</div>
          <blockquote>{review.quote}</blockquote>
          <footer className="showcase-review-footer"><div className="showcase-review-byline"><strong>{t('Sample author', 'နမူနာအမည်')} {lang === 'my' ? ['၀၁', '၀၂', '၀၃'][index] : String(index + 1).padStart(2, '0')}</strong><span>{t('Invitation Studio · fictional example', 'ဖိတ်စာစတူဒီယို · သရုပ်ပြနမူနာ')}</span></div><span className="showcase-review-sample-tag">{t('SAMPLE ONLY', 'နမူနာသာ')}</span></footer>
        </article>)}</div>
        <button type="button" className="showcase-reviews-cta" onClick={onCreate}>{t('Create an invitation of your own', 'ကိုယ်ပိုင်ဖိတ်စာ ဖန်တီးကြည့်ပါ')}<ArrowRight size={17} aria-hidden="true"/></button>
      </section>

      <section className="showcase-faq" id="faq" aria-labelledby="showcase-faq-title">
        <div className="showcase-faq-heading"><span className="showcase-section-kicker">{t('GOOD TO KNOW', 'သိထားသင့်သော အချက်များ')}</span><h2 id="showcase-faq-title">{t('Frequently asked questions', 'မေးလေ့ရှိသော မေးခွန်းများ')}</h2></div>
        <div className="showcase-faq-list">{showcaseFaqs[lang].map((item, index) => <details className="showcase-faq-item" key={item.question}>
          <summary><span className="showcase-faq-index">{String(index + 1).padStart(2, '0')}</span><span className="showcase-faq-question">{item.question}</span><span className="showcase-faq-toggle" aria-hidden="true"/></summary>
          <div className="showcase-faq-answer"><p>{item.answer}</p></div>
        </details>)}</div>
      </section>
    </main>

    <footer className="showcase-footer"><div className="showcase-footer-brand"><a href="/" aria-label="Toewaioo's Studio home"><span>Toewaioo's Studio</span></a><small>{t('Thoughtful designs, made to be shared.', 'မျှဝေဖို့ ဖန်တီးထားသော ဒီဇိုင်းများ။')}</small></div><div className="showcase-footer-explore"><span>{t('EXPLORE', 'လေ့လာရန်')}</span><nav aria-label={t('Browse categories', 'အမျိုးအစားများ ကြည့်ရန်')}>{showcaseCategories.map(category => <a href="#featured" key={category.id} onClick={() => setSelectedCategory(category.id)}>{lang === 'en' ? category.en : category.my}</a>)}</nav></div><div className="showcase-footer-utility"><a href="#featured" onClick={() => setSelectedCategory('3d-experiences')}>Love Galaxy<ArrowUpRight size={13}/></a><a href="/manage"><LockKeyhole size={13}/>{t('Private management', 'သီးသန့်စီမံခန့်ခွဲမှု')}</a><button type="button" onClick={onCreate}>{t('Create an invitation', 'ဖိတ်စာဖန်တီးမယ်')}<ArrowRight size={13}/></button></div></footer>
  </div>;
}
