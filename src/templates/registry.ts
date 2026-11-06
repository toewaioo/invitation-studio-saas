export const INVITATION_TEMPLATES = [
  {
    id: 'thazin',
    name: 'Thazin',
    descriptionEn: 'Botanical · Paper book',
    descriptionMy: 'ပန်းအလှဆင် စာအုပ်',
    editorDescription: 'Botanical book',
    defaultTheme: 'sage',
    preview: {
      src: '/assets/showcase-preview/thazin.webp',
      enAlt: 'Rendered Thazin wedding invitation with a botanical pop-up arch and Burmese couple names.',
      myAlt: 'ပန်းမုခ်ဦးနှင့် မြန်မာစုံတွဲအမည်များ ပါဝင်သော သဇင် မင်္ဂလာဖိတ်စာ နမူနာ။',
    },
    arrival: {
      eyebrow: 'A LETTER SEALED WITH LOVE',
      title: 'မေတ္တာနဲ့ ရောက်လာတဲ့ ဖိတ်စာလေး',
      heading: 'မေတ္တာပန်းမုခ်ဦး',
      kicker: 'A LITTLE WORLD OF OUR LOVE',
      foot: 'နှစ်ယောက်တည်းကနေ တစ်ဘဝတည်းသို့',
      scene: 'စာရွက်မှ ထောင်တက်လာသော ပန်းမုခ်ဦး',
    },
  },
  {
    id: 'noir',
    name: 'Golden Vow',
    descriptionEn: 'Geometric · Art deco',
    descriptionMy: 'ရွှေရောင် Art deco',
    editorDescription: 'Art deco',
    defaultTheme: 'midnight',
    preview: {
      src: '/assets/showcase-preview/golden-vow.webp',
      enAlt: 'Rendered Golden Vow wedding invitation with an art-deco frame and a couple portrait.',
      myAlt: 'Art deco ဘောင်နှင့် စုံတွဲပုံပါဝင်သော Golden Vow မင်္ဂလာဖိတ်စာ နမူနာ။',
    },
    arrival: {
      eyebrow: 'A LOVE WORTH ITS WEIGHT IN GOLD',
      title: 'ရွှေရောင် အမှတ်တရတစ်စောင်',
      heading: 'ရွှေရောင် ကတိစကား',
      kicker: 'THE GOLDEN VOW',
      foot: 'A timeless love. A golden beginning.',
      scene: 'သုံးဖက်ခေါက် Art Deco ဓာတ်ပုံနှင့် ရွှေရောင်ဘောင်',
    },
  },
  {
    id: 'rose',
    name: 'Rose Reverie',
    descriptionEn: 'Floral · Layered paper',
    descriptionMy: 'ပန်းရောင် စက္ကူပန်း',
    editorDescription: 'Paper blossom',
    defaultTheme: 'rose',
    preview: {
      src: '/assets/showcase-preview/rose-reverie.webp',
      enAlt: 'Rendered Rose Reverie wedding invitation with layered rose paper and a couple portrait.',
      myAlt: 'အလွှာလိုက် ပန်းရောင်စက္ကူနှင့် စုံတွဲပုံပါဝင်သော Rose Reverie မင်္ဂလာဖိတ်စာ နမူနာ။',
    },
    arrival: {
      eyebrow: 'TWO HEARTS. ONE BEAUTIFUL STORY.',
      title: 'နှလုံးသားနှစ်ခုရဲ့ ပန်းပွင့်ချိန်',
      heading: 'အချစ်တို့ ပွင့်လန်းရာ',
      kicker: 'A BLOSSOM MADE OF MEMORIES',
      foot: 'ချစ်ခြင်းမေတ္တာနဲ့ အတူ ပွင့်လန်းကြမယ်',
      scene: 'ပန်းပွင့်ပုံ စာရွက်အလွှာများကြားမှ ထောင်တက်လာသည့် စုံတွဲဓာတ်ပုံ',
    },
  },
] as const;

export type InvitationTemplateId = (typeof INVITATION_TEMPLATES)[number]['id'];
export type InvitationTemplate = (typeof INVITATION_TEMPLATES)[number];

export function getInvitationTemplate(id: string | null | undefined): InvitationTemplate {
  return INVITATION_TEMPLATES.find((template) => template.id === id) ?? INVITATION_TEMPLATES[0];
}
