import type { Design, Language, Photo, Project } from "../types";

/** The map in this fixture is a valid Google Maps directions URL for sample coordinates only. */
export const SAMPLE_MAP_NOTICE =
  "Sample map only — copied from the original demo; not a real event invitation.";

const SAMPLE = {
  person_a: "မောင်သီဟအောင်",
  person_b: "မနှင်းသဇင်",
  parent_a: "ဦးဇော်ဝင်းထွန်း နှင့် ဒေါ်ခင်မာအေး\nတို့၏ သား",
  parent_b: "ဦးလှမြင့်အောင် နှင့် ဒေါ်သီတာဝင်း\nတို့၏ သမီး",
  event_date: "2027-02-14",
  event_time: "",
  venue: "လိုတရ ဟင်္သာတကျောင်းတိုက်\nအောင်သုခ (၃) လမ်း၊ (၁၅) ရပ်ကွက်\nရွှေပြည်သာမြို့နယ်၊ ရန်ကုန်",
  message:
    "တို့၏ မင်္ဂလာဧည့်ခံပွဲသို့ ကြွရောက်ချီးမြှင့်ပါရန် နှစ်ဖက်မိဘနှစ်ပါး၊ ညီအစ်ကိုမောင်နှမများ၊ ဆွေမျိုးမိတ်သင်္ဂဟများနှင့်အတူ လေးစားစွာ ဖိတ်ကြားအပ်ပါသည်။",
  map_url:
    "https://www.google.com/maps/dir/?api=1&destination=17.0002815%2C96.0650261",
} as const;

const photoFixture = (number: 1 | 2 | 3, caption: string, position: number): Photo => ({
  id: `sample-wedding-${number}`,
  url: `/assets/wedding-${number}.jpg`,
  caption,
  position,
});

/** Create an independent, non-persisted sample project for the three design previews. */
export function createDesignPreview(design: Design, language: Language): Project {
  const now = new Date().toISOString();
  const photos = [
    photoFixture(1, "Together, a beautiful beginning.", 0),
    photoFixture(2, "All the beautiful days", 1),
    photoFixture(3, "You, always", 2),
  ];

  return {
    id: "design-preview",
    title: language === "en" ? "Sample wedding invitation" : "ဒီဇိုင်းသရုပ်ပြ နမူနာဖိတ်စာ",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    private_notes: "",
    person_a: SAMPLE.person_a,
    person_b: SAMPLE.person_b,
    parent_a: SAMPLE.parent_a,
    parent_b: SAMPLE.parent_b,
    event_date: SAMPLE.event_date,
    event_time: SAMPLE.event_time,
    schedule: [
      { time: "07:00", label: "မင်္ဂလာအခမ်းအနား စတင်ခြင်း" },
      { time: "08:00", label: "မင်္ဂလာဆုမွန်ကောင်း ခံယူခြင်း" },
      { time: "09:00", label: "မင်္ဂလာဧည့်ခံပွဲ" },
      { time: "10:00", label: "အမှတ်တရ ဓာတ်ပုံရိုက်ခြင်း" },
    ],
    venue: SAMPLE.venue,
    message: SAMPLE.message,
    map_url: SAMPLE.map_url,
    username: "design-preview",
    template: design,
    theme: design === "noir" ? "midnight" : design === "rose" ? "rose" : "sage",
    project_type: "wedding",
    status: "draft",
    public_key: null,
    photos,
    created_at: now,
    updated_at: now,
  };
}
