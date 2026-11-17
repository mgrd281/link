import type { Page } from "@linkyo/blocks";

/**
 * Private preview prepared for Nizar Alkrizma to look at before he decides on a Linkyo page.
 * Text and links come from his public YouTube and TikTok profiles; pictures are loaded from his own
 * YouTube channel (not copied). Not listed anywhere, not indexed, removed on request.
 */
export const nizarDe: Page = {
  profile: {
    username: "nizarals9",
    displayName: "Nizar Alkrizma",
    bio: "Aus Syrien 🇸🇾, zu Hause in Deutschland 🇩🇪. Meine neue Single „Samra“ gibt es jetzt auf allen Plattformen.",
    location: "Deutschland",
    avatar: {
      src: "https://yt3.googleusercontent.com/EI77g1by5OoPFbA25rLWxwR1EL4sdEXPkf47FkEsf6dtD4n70XH9TQGNdRfTWshGnP9giQiOHw=s1080-c-k-c0x00ffffff-no-rj",
      alt: "Nizar Alkrizma",
      tone: "dark",
    },
    tagline: "Syrischer Künstler & Content Creator",
    verified: false,
    locale: "de",
  },
  blocks: [
    {
      id: "socials",
      type: "socials",
      visible: true,
      highlight: false,
      items: [
        {
          platform: "tiktok",
          url: "https://www.tiktok.com/@nizarals9",
        },
        {
          platform: "youtube",
          url: "https://www.youtube.com/@nizarals9",
        },
        {
          platform: "email",
          url: "mailto:nezaralsweid4@gmail.com",
        },
      ],
    },
    {
      id: "songs",
      type: "header",
      visible: true,
      highlight: false,
      title: "Meine Songs",
    },
    {
      id: "video-H_Zxy-6-ZoY",
      type: "video",
      visible: true,
      highlight: true,
      title: "Wyli Karizma · ويلي كريزما",
      provider: "youtube",
      url: "https://www.youtube.com/watch?v=H_Zxy-6-ZoY",
      poster: {
        src: "https://i.ytimg.com/vi/H_Zxy-6-ZoY/maxresdefault.jpg",
        alt: "Wyli Karizma · ويلي كريزما",
        tone: "light",
      },
      duration: 139,
    },
    {
      id: "video-rkX5jwuMCwc",
      type: "video",
      visible: true,
      highlight: false,
      title: "Ka3b 3ali · كعب عالي",
      provider: "youtube",
      url: "https://www.youtube.com/watch?v=rkX5jwuMCwc",
      poster: {
        src: "https://i.ytimg.com/vi/rkX5jwuMCwc/maxresdefault.jpg",
        alt: "Ka3b 3ali · كعب عالي",
        tone: "dark",
      },
      duration: 145,
    },
    {
      id: "video-O001dtgxTdU",
      type: "video",
      visible: true,
      highlight: false,
      title: "Nutella · نوتيلا",
      provider: "youtube",
      url: "https://www.youtube.com/watch?v=O001dtgxTdU",
      poster: {
        src: "https://i.ytimg.com/vi/O001dtgxTdU/maxresdefault.jpg",
        alt: "Nutella · نوتيلا",
        tone: "dark",
      },
      duration: 151,
    },
    {
      id: "shorts",
      type: "shorts",
      visible: true,
      highlight: false,
      title: "Neueste Clips",
      items: [
        {
          title: "أول عربي بيشتري آيفون 18 🔥",
          url: "https://www.youtube.com/shorts/TgawAHA2iLY",
          poster: {
            src: "https://i.ytimg.com/vi/TgawAHA2iLY/oar2.jpg",
            alt: "أول عربي بيشتري آيفون 18 🔥",
          },
          views: 1800000,
        },
        {
          title: "وين أهل حلب 🔥🤍",
          url: "https://www.youtube.com/shorts/LyHC9ky5C_U",
          poster: {
            src: "https://i.ytimg.com/vi/LyHC9ky5C_U/oar2.jpg",
            alt: "وين أهل حلب 🔥🤍",
          },
          views: 651000,
        },
        {
          title: "نوتيلااا",
          url: "https://www.youtube.com/shorts/ftNwENj9lfA",
          poster: {
            src: "https://i.ytimg.com/vi/ftNwENj9lfA/oar2.jpg",
            alt: "نوتيلااا",
          },
          views: 2100000,
        },
        {
          title: "حفظتوهاا ⁉️🔥",
          url: "https://www.youtube.com/shorts/2w6Wpd6-IPA",
          poster: {
            src: "https://i.ytimg.com/vi/2w6Wpd6-IPA/oar2.jpg",
            alt: "حفظتوهاا ⁉️🔥",
          },
          views: 427000,
        },
        {
          title: "من الشام 🔥",
          url: "https://www.youtube.com/shorts/fl_1883wsbM",
          poster: {
            src: "https://i.ytimg.com/vi/fl_1883wsbM/oar2.jpg",
            alt: "من الشام 🔥",
          },
          views: 499000,
        },
        {
          title: "«سمرا» صارت على جميع المنصات",
          url: "https://www.youtube.com/shorts/KTMSwOWZYtE",
          poster: {
            src: "https://i.ytimg.com/vi/KTMSwOWZYtE/oar2.jpg",
            alt: "«سمرا» صارت على جميع المنصات",
          },
          views: 32000,
        },
      ],
    },
    {
      id: "follow",
      type: "header",
      visible: true,
      highlight: false,
      title: "Folge mir",
    },
    {
      id: "tiktok",
      type: "link",
      visible: true,
      highlight: true,
      title: "TikTok · 2,3 Mio. Follower",
      url: "https://www.tiktok.com/@nizarals9",
    },
    {
      id: "youtube",
      type: "link",
      visible: true,
      highlight: false,
      title: "YouTube · 310.000 Abonnenten",
      url: "https://www.youtube.com/@nizarals9",
    },
    {
      id: "business",
      type: "header",
      visible: true,
      highlight: false,
      title: "Kooperationen",
    },
    {
      id: "booking",
      type: "link",
      visible: true,
      highlight: false,
      title: "Business & Booking",
      url: "mailto:nezaralsweid4@gmail.com",
    },
  ],
};

export const nizarAr: Page = {
  profile: {
    username: "nizarals9",
    displayName: "نزار الكريزما",
    bio: "من سوريا 🇸🇾 وعايش بألمانيا 🇩🇪. أغنيتي الجديدة «سمرا» صارت على كل المنصات.",
    location: "ألمانيا",
    avatar: {
      src: "https://yt3.googleusercontent.com/EI77g1by5OoPFbA25rLWxwR1EL4sdEXPkf47FkEsf6dtD4n70XH9TQGNdRfTWshGnP9giQiOHw=s1080-c-k-c0x00ffffff-no-rj",
      alt: "نزار الكريزما",
      tone: "dark",
    },
    tagline: "فنان وصانع محتوى سوري",
    verified: false,
    locale: "ar",
  },
  blocks: [
    {
      id: "socials",
      type: "socials",
      visible: true,
      highlight: false,
      items: [
        {
          platform: "tiktok",
          url: "https://www.tiktok.com/@nizarals9",
        },
        {
          platform: "youtube",
          url: "https://www.youtube.com/@nizarals9",
        },
        {
          platform: "email",
          url: "mailto:nezaralsweid4@gmail.com",
        },
      ],
    },
    {
      id: "songs",
      type: "header",
      visible: true,
      highlight: false,
      title: "أغانيّ",
    },
    {
      id: "video-H_Zxy-6-ZoY",
      type: "video",
      visible: true,
      highlight: true,
      title: "ويلي كريزما · Wyli Karizma",
      provider: "youtube",
      url: "https://www.youtube.com/watch?v=H_Zxy-6-ZoY",
      poster: {
        src: "https://i.ytimg.com/vi/H_Zxy-6-ZoY/maxresdefault.jpg",
        alt: "ويلي كريزما · Wyli Karizma",
        tone: "light",
      },
      duration: 139,
    },
    {
      id: "video-rkX5jwuMCwc",
      type: "video",
      visible: true,
      highlight: false,
      title: "كعب عالي · Ka3b 3ali",
      provider: "youtube",
      url: "https://www.youtube.com/watch?v=rkX5jwuMCwc",
      poster: {
        src: "https://i.ytimg.com/vi/rkX5jwuMCwc/maxresdefault.jpg",
        alt: "كعب عالي · Ka3b 3ali",
        tone: "dark",
      },
      duration: 145,
    },
    {
      id: "video-O001dtgxTdU",
      type: "video",
      visible: true,
      highlight: false,
      title: "نوتيلا · Nutella",
      provider: "youtube",
      url: "https://www.youtube.com/watch?v=O001dtgxTdU",
      poster: {
        src: "https://i.ytimg.com/vi/O001dtgxTdU/maxresdefault.jpg",
        alt: "نوتيلا · Nutella",
        tone: "dark",
      },
      duration: 151,
    },
    {
      id: "shorts",
      type: "shorts",
      visible: true,
      highlight: false,
      title: "أحدث المقاطع",
      items: [
        {
          title: "أول عربي بيشتري آيفون 18 🔥",
          url: "https://www.youtube.com/shorts/TgawAHA2iLY",
          poster: {
            src: "https://i.ytimg.com/vi/TgawAHA2iLY/oar2.jpg",
            alt: "أول عربي بيشتري آيفون 18 🔥",
          },
          views: 1800000,
        },
        {
          title: "وين أهل حلب 🔥🤍",
          url: "https://www.youtube.com/shorts/LyHC9ky5C_U",
          poster: {
            src: "https://i.ytimg.com/vi/LyHC9ky5C_U/oar2.jpg",
            alt: "وين أهل حلب 🔥🤍",
          },
          views: 651000,
        },
        {
          title: "نوتيلااا",
          url: "https://www.youtube.com/shorts/ftNwENj9lfA",
          poster: {
            src: "https://i.ytimg.com/vi/ftNwENj9lfA/oar2.jpg",
            alt: "نوتيلااا",
          },
          views: 2100000,
        },
        {
          title: "حفظتوهاا ⁉️🔥",
          url: "https://www.youtube.com/shorts/2w6Wpd6-IPA",
          poster: {
            src: "https://i.ytimg.com/vi/2w6Wpd6-IPA/oar2.jpg",
            alt: "حفظتوهاا ⁉️🔥",
          },
          views: 427000,
        },
        {
          title: "من الشام 🔥",
          url: "https://www.youtube.com/shorts/fl_1883wsbM",
          poster: {
            src: "https://i.ytimg.com/vi/fl_1883wsbM/oar2.jpg",
            alt: "من الشام 🔥",
          },
          views: 499000,
        },
        {
          title: "«سمرا» صارت على جميع المنصات",
          url: "https://www.youtube.com/shorts/KTMSwOWZYtE",
          poster: {
            src: "https://i.ytimg.com/vi/KTMSwOWZYtE/oar2.jpg",
            alt: "«سمرا» صارت على جميع المنصات",
          },
          views: 32000,
        },
      ],
    },
    {
      id: "follow",
      type: "header",
      visible: true,
      highlight: false,
      title: "تابعني",
    },
    {
      id: "tiktok",
      type: "link",
      visible: true,
      highlight: true,
      title: "2.3 مليون متابع على TikTok",
      url: "https://www.tiktok.com/@nizarals9",
    },
    {
      id: "youtube",
      type: "link",
      visible: true,
      highlight: false,
      title: "310 ألف مشترك على YouTube",
      url: "https://www.youtube.com/@nizarals9",
    },
    {
      id: "business",
      type: "header",
      visible: true,
      highlight: false,
      title: "للتعاون",
    },
    {
      id: "booking",
      type: "link",
      visible: true,
      highlight: false,
      title: "للأعمال والحجوزات",
      url: "mailto:nezaralsweid4@gmail.com",
    },
  ],
};
