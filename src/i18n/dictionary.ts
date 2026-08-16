/**
 * Al-Nabi UI dictionary — Uzbek / Russian / English.
 * Access via useLanguage(): t.header.*, t.chat.*, t.nav.*, t.common.*, t.admin.*
 */

export type AppLocale = "uz" | "ru" | "en";

export type Dictionary = {
  header: {
    brand: string;
    producerChat: string;
    language: string;
    theme: string;
    balance: string;
  };
  nav: {
    home: string;
    studio: string;
    translator: string;
    cabinet: string;
    dashboard: string;
    generate: string;
    producer: string;
    templates: string;
    scriptMovie: string;
    history: string;
    store: string;
    pricing: string;
    profile: string;
    balance: string;
    collapse: string;
    expand: string;
    navigation: string;
    admin: string;
  };
  chat: {
    title: string;
    engine: string;
    welcome: string;
    placeholder: string;
    send: string;
    uploadImage: string;
    attachLink: string;
    remove: string;
    imageAttached: string;
    beginner: string;
    advanced: string;
    close: string;
    produce: string;
    voicePreview: string;
    voicePreviewFree: string;
    reels: string;
    youtube: string;
    epicVoice: string;
    calmVoice: string;
    dialogue: string;
    session: string;
    aspect: string;
    narration: string;
    audio: string;
    bgmTitle: string;
    bgmAi: string;
    bgmManual: string;
    bgmOff: string;
    bgmAiHint: string;
    bgmEmpty: string;
    bgmLoading: string;
    currency: string;
    output: string;
    rendering: string;
    vaultHint: string;
    navGenerate: string;
    navTemplates: string;
    navBalance: string;
    navHistory: string;
    previewReady: string;
    produceReady: string;
    wallpaper: string;
    fallbackResponse: string;
    fallbackGuide: string;
    fallbackConverse: string;
    fallbackContinue: string;
    fallbackDescribe: string;
  };
  common: {
    download: string;
    share: string;
    delete: string;
    refresh: string;
    preview: string;
    buy: string;
    close: string;
    cancel: string;
    save: string;
    unlock: string;
    generate: string;
    signOut: string;
    search: string;
    vault: string;
    loading: string;
  };
  admin: {
    title: string;
    unlock: string;
    runWatch: string;
    approve: string;
    dismiss: string;
    pending: string;
    activeEndpoints: string;
    coreSystem: string;
    currency: string;
    engine: string;
    vaultFee: string;
    status: string;
    ready: string;
    needsKeys: string;
    secretPlaceholder: string;
    analyticsEyebrow: string;
    analyticsTitle: string;
    analyticsSubtitle: string;
    filterToday: string;
    filter5Days: string;
    filterWeek: string;
    filterMonth: string;
    filterCustom: string;
    applyRange: string;
    totalRevenue: string;
    netProfit: string;
    activePayingUsers: string;
    lifetimePaying: string;
    totalNcBalance: string;
    totalNcBalanceHint: string;
    apiOverhead: string;
    ncIssued: string;
    ncConsumed: string;
    dailyIncome: string;
    packBreakdown: string;
    recentTransactions: string;
    colTime: string;
    colUser: string;
    colPack: string;
    colAmount: string;
    colNc: string;
    orders: string;
    emptyTransactions: string;
    emptyChart: string;
    loadError: string;
    modelsLink: string;
  };
};

const en: Dictionary = {
  header: {
    brand: "Al-Nabi",
    producerChat: "Chat",
    language: "Language",
    theme: "Theme",
    balance: "Balance",
  },
  nav: {
    home: "Home",
    studio: "Studio",
    translator: "Translator",
    cabinet: "Cabinet",
    dashboard: "Dashboard",
    generate: "AI Generate",
    producer: "Producer",
    templates: "Templates",
    scriptMovie: "Script-to-Movie",
    history: "History",
    store: "Store",
    pricing: "Pricing",
    profile: "Profile",
    balance: "Balance",
    collapse: "Collapse",
    expand: "Expand",
    navigation: "Primary navigation",
    admin: "Admin",
  },
  chat: {
    title: "Producer Chat",
    engine: "Studio",
    welcome:
      "Drop a screenshot, paste a YouTube link, or describe a scene. Ask about NC or Cloud Vault anytime.",
    placeholder: "Idea, YouTube link, or ask about NC…",
    send: "Send",
    uploadImage: "Upload image",
    attachLink: "Attach link",
    remove: "remove",
    imageAttached: "Image attached",
    beginner: "beginner",
    advanced: "advanced",
    close: "Close",
    produce: "Produce video",
    voicePreview: "3s voice preview",
    voicePreviewFree: "3s voice preview · 0 NC",
    reels: "Reels 9:16",
    youtube: "YouTube 16:9",
    epicVoice: "Epic voice",
    calmVoice: "Calm voice",
    dialogue: "Dialogue",
    session: "Session",
    aspect: "Aspect",
    narration: "Narration",
    audio: "Voice",
    bgmTitle: "Background music",
    bgmAi: "AI picks",
    bgmManual: "I choose",
    bgmOff: "No music",
    bgmAiHint: "Matches mood from your brief (calm / epic / suspense / upbeat).",
    bgmEmpty: "Background music is unavailable for this project.",
    bgmLoading: "Loading tracks…",
    currency: "NC",
    output: "Output",
    rendering: "Rendering picture + voice + Foley…",
    vaultHint:
      "Final file includes frame-synced Foley. Vault re-download: 5 NC after first unlock.",
    navGenerate: "Generate",
    navTemplates: "Templates",
    navBalance: "Balance · NC",
    navHistory: "Cloud Vault",
    previewReady: "3s voice preview ready — 0 NC.",
    produceReady: "Ready. Picture, voice, and Foley cues — synced and saved to Cloud Vault.",
    wallpaper: "Wallpaper",
    fallbackResponse:
      "Send an idea, screenshot, or link. Tap Reels or YouTube, pick a voice, then Produce.",
    fallbackGuide:
      "Studio creates video. Cabinet holds balance and history. Chat can pick a template. Vault re-downloads cost 5 NC after the first unlock.",
    fallbackConverse: "Hey — what are we making? Share an idea or ask a question.",
    fallbackContinue: "Continue.",
    fallbackDescribe: "Describe the scene or pick a format.",
  },
  common: {
    download: "Download",
    share: "Share",
    delete: "Delete",
    refresh: "Refresh",
    preview: "Preview",
    buy: "Buy",
    close: "Close",
    cancel: "Cancel",
    save: "Save",
    unlock: "Unlock",
    generate: "Generate",
    signOut: "Sign out",
    search: "Search…",
    vault: "Vault",
    loading: "Loading…",
  },
  admin: {
    title: "Model Updater Dashboard",
    unlock: "Unlock",
    runWatch: "Run watch now",
    approve: "Approve & Update API Route",
    dismiss: "Dismiss",
    pending: "Pending approvals",
    activeEndpoints: "Active endpoints",
    coreSystem: "Core system",
    currency: "Currency",
    engine: "Engine",
    vaultFee: "Vault re-download",
    status: "Status",
    ready: "Ready",
    needsKeys: "Needs keys",
    secretPlaceholder: "Admin secret",
    analyticsEyebrow: "Admin · Finance",
    analyticsTitle: "Analytics & Finance",
    analyticsSubtitle:
      "Revenue, API overhead, NC flow, and package sales for the selected window.",
    filterToday: "Today",
    filter5Days: "5 days",
    filterWeek: "1 week",
    filterMonth: "1 month",
    filterCustom: "Custom",
    applyRange: "Apply",
    totalRevenue: "Total revenue",
    netProfit: "Net profit",
    activePayingUsers: "Active paying users",
    lifetimePaying: "Lifetime",
    totalNcBalance: "Total NC balance",
    totalNcBalanceHint: "Outstanding wallet liability",
    apiOverhead: "Est. API cost",
    ncIssued: "NC issued",
    ncConsumed: "NC consumed",
    dailyIncome: "Daily income",
    packBreakdown: "Sales by package",
    recentTransactions: "Recent transactions",
    colTime: "Time",
    colUser: "User",
    colPack: "Pack",
    colAmount: "Amount",
    colNc: "NC",
    orders: "orders",
    emptyTransactions: "No paid transactions in this window.",
    emptyChart: "No sales in this window.",
    loadError: "Could not load analytics",
    modelsLink: "Model updater",
  },
};

const uz: Dictionary = {
  header: {
    brand: "Al-Nabi",
    producerChat: "Chat",
    language: "Til",
    theme: "Mavzu",
    balance: "Balans",
  },
  nav: {
    home: "Bosh sahifa",
    studio: "Studio",
    translator: "Tarjimon",
    cabinet: "Kabinet",
    dashboard: "Kabinet",
    generate: "AI Generatsiya",
    producer: "Producer",
    templates: "Shablonlar",
    scriptMovie: "Skript-film",
    history: "Tarix",
    store: "Do‘kon",
    pricing: "Narxlar",
    profile: "Profil",
    balance: "Balans",
    collapse: "Yig‘ish",
    expand: "Yoyish",
    navigation: "Asosiy navigatsiya",
    admin: "Admin",
  },
  chat: {
    title: "Producer Chat",
    engine: "Studio",
    welcome:
      "Skrinshot tashlang, YouTube havolasini joylashtiring yoki sahnani yozing. NC yoki Cloud Vault haqida so‘rang.",
    placeholder: "G‘oya, YouTube havola yoki NC haqida savol…",
    send: "Yuborish",
    uploadImage: "Rasm yuklash",
    attachLink: "Havola biriktirish",
    remove: "olib tashlash",
    imageAttached: "Rasm biriktirildi",
    beginner: "boshlang‘ich",
    advanced: "professional",
    close: "Yopish",
    produce: "Video yaratish",
    voicePreview: "3s ovoz preview",
    voicePreviewFree: "3s ovoz preview · 0 NC",
    reels: "Reels 9:16",
    youtube: "YouTube 16:9",
    epicVoice: "Epik ovoz",
    calmVoice: "Tinch ovoz",
    dialogue: "Dialog",
    session: "Sessiya",
    aspect: "Format",
    narration: "Ovoz",
    audio: "Ovoz",
    bgmTitle: "Fon musiqasi",
    bgmAi: "AI tanlasin",
    bgmManual: "O'zim tanlayman",
    bgmOff: "Musiqasiz",
    bgmAiHint: "Skript kayfiyatiga qarab tanlanadi (tinch / epik / suspense / quvnoq).",
    bgmEmpty: "Bu loyiha uchun fon musiqasi hozircha mavjud emas.",
    bgmLoading: "Treklar yuklanmoqda…",
    currency: "NC",
    output: "Natija",
    rendering: "Rasm + ovoz + Foley render qilinmoqda…",
    vaultHint:
      "Yakuniy faylda sinxron Foley bor. Vault qayta yuklash: birinchi bepul, keyin 5 NC.",
    navGenerate: "Generatsiya",
    navTemplates: "Shablonlar",
    navBalance: "Balans · NC",
    navHistory: "Cloud Vault",
    previewReady: "3s ovoz preview tayyor — 0 NC.",
    produceReady:
      "Tayyor. Rasm, ovoz va Foley — sinxron, Cloud Vault’ga saqlandi.",
    wallpaper: "Fon",
    fallbackResponse:
      "G‘oya, skrinshot yoki havola yuboring. Reels yoki YouTube ni tanlang, ovozni belgilang, keyin Produce.",
    fallbackGuide:
      "Studio video yaratadi. Kabinetda balans va tarix. Chat shablon tanlaydi. Cloud Vault qayta yuklash: birinchi bepul, keyin 5 NC.",
    fallbackConverse: "Salom — nima qilamiz? G‘oya ayting yoki savol bering.",
    fallbackContinue: "Davom eting.",
    fallbackDescribe: "Sahna yoki formatni tasvirlab bering.",
  },
  common: {
    download: "Yuklab olish",
    share: "Ulashish",
    delete: "O‘chirish",
    refresh: "Yangilash",
    preview: "Ko‘rish",
    buy: "Sotib olish",
    close: "Yopish",
    cancel: "Bekor qilish",
    save: "Saqlash",
    unlock: "Ochish",
    generate: "Yaratish",
    signOut: "Chiqish",
    search: "Qidiruv…",
    vault: "Vault",
    loading: "Yuklanmoqda…",
  },
  admin: {
    title: "Model yangilash paneli",
    unlock: "Ochish",
    runWatch: "Hozir tekshirish",
    approve: "Tasdiqlash va API’ni almashtirish",
    dismiss: "Rad etish",
    pending: "Kutilayotgan tasdiqlar",
    activeEndpoints: "Faol endpointlar",
    coreSystem: "Asosiy tizim",
    currency: "Valyuta",
    engine: "Dvigatel",
    vaultFee: "Vault qayta yuklash",
    status: "Holat",
    ready: "Tayyor",
    needsKeys: "Kalit kerak",
    secretPlaceholder: "Admin maxfiy kaliti",
    analyticsEyebrow: "Admin · Moliya",
    analyticsTitle: "Analitika va moliya",
    analyticsSubtitle:
      "Tanlangan davr uchun tushum, API xarajati, NC oqimi va paket savdosi.",
    filterToday: "Bugun",
    filter5Days: "5 kun",
    filterWeek: "1 hafta",
    filterMonth: "1 oy",
    filterCustom: "Maxsus",
    applyRange: "Qo‘llash",
    totalRevenue: "Jami tushum",
    netProfit: "Sof foyda",
    activePayingUsers: "Faol to‘lovchilar",
    lifetimePaying: "Jami",
    totalNcBalance: "Jami NC balans",
    totalNcBalanceHint: "Hali ishlatilmagan hamyon majburiyati",
    apiOverhead: "Taxm. API xarajati",
    ncIssued: "Berilgan NC",
    ncConsumed: "Sarflangan NC",
    dailyIncome: "Kunlik tushum",
    packBreakdown: "Paketlar bo‘yicha savdo",
    recentTransactions: "So‘nggi tranzaksiyalar",
    colTime: "Vaqt",
    colUser: "Foydalanuvchi",
    colPack: "Paket",
    colAmount: "Summa",
    colNc: "NC",
    orders: "buyurtma",
    emptyTransactions: "Bu davrda to‘langan tranzaksiya yo‘q.",
    emptyChart: "Bu davrda savdo yo‘q.",
    loadError: "Analitikani yuklab bo‘lmadi",
    modelsLink: "Model yangilash",
  },
};

const ru: Dictionary = {
  header: {
    brand: "Al-Nabi",
    producerChat: "Чат",
    language: "Язык",
    theme: "Тема",
    balance: "Баланс",
  },
  nav: {
    home: "Главная",
    studio: "Студия",
    translator: "Переводчик",
    cabinet: "Кабинет",
    dashboard: "Кабинет",
    generate: "AI Генерация",
    producer: "Продюсер",
    templates: "Шаблоны",
    scriptMovie: "Скрипт-фильм",
    history: "История",
    store: "Магазин",
    pricing: "Цены",
    profile: "Профиль",
    balance: "Баланс",
    collapse: "Свернуть",
    expand: "Развернуть",
    navigation: "Основная навигация",
    admin: "Админ",
  },
  chat: {
    title: "Producer Chat",
    engine: "Studio",
    welcome:
      "Загрузите скриншот, вставьте ссылку YouTube или опишите сцену. Спросите про NC или Cloud Vault.",
    placeholder: "Идея, ссылка YouTube или вопрос про NC…",
    send: "Отправить",
    uploadImage: "Загрузить изображение",
    attachLink: "Прикрепить ссылку",
    remove: "убрать",
    imageAttached: "Изображение прикреплено",
    beginner: "новичок",
    advanced: "профи",
    close: "Закрыть",
    produce: "Создать видео",
    voicePreview: "3с превью голоса",
    voicePreviewFree: "3с превью голоса · 0 NC",
    reels: "Reels 9:16",
    youtube: "YouTube 16:9",
    epicVoice: "Эпичный голос",
    calmVoice: "Спокойный голос",
    dialogue: "Диалог",
    session: "Сессия",
    aspect: "Формат",
    narration: "Озвучка",
    audio: "Голос",
    bgmTitle: "Фоновая музыка",
    bgmAi: "Выберет ИИ",
    bgmManual: "Выберу сам",
    bgmOff: "Без музыки",
    bgmAiHint: "По настроению брифа (спокойная / эпик / саспенс / энергичная).",
    bgmEmpty: "Фоновая музыка пока недоступна для этого проекта.",
    bgmLoading: "Загрузка треков…",
    currency: "NC",
    output: "Результат",
    rendering: "Рендер картинки + голоса + Foley…",
    vaultHint:
      "В финале — синхронный Foley. Повторная загрузка из Vault: 5 NC после первого раза.",
    navGenerate: "Генерация",
    navTemplates: "Шаблоны",
    navBalance: "Баланс · NC",
    navHistory: "Cloud Vault",
    previewReady: "3с превью голоса готово — 0 NC.",
    produceReady:
      "Готово. Картинка, голос и Foley — синхронизированы и сохранены в Cloud Vault.",
    wallpaper: "Обои",
    fallbackResponse:
      "Отправьте идею, скриншот или ссылку. Выберите Reels или YouTube, голос — затем Produce.",
    fallbackGuide:
      "Студия создаёт видео. Кабинет — баланс и история. Чат подберёт шаблон. Повторная загрузка Cloud Vault: 5 NC после первого раза.",
    fallbackConverse: "Привет — что делаем? Идею или вопрос — пишите.",
    fallbackContinue: "Продолжайте.",
    fallbackDescribe: "Опишите сцену или выберите формат.",
  },
  common: {
    download: "Скачать",
    share: "Поделиться",
    delete: "Удалить",
    refresh: "Обновить",
    preview: "Просмотр",
    buy: "Купить",
    close: "Закрыть",
    cancel: "Отмена",
    save: "Сохранить",
    unlock: "Открыть",
    generate: "Создать",
    signOut: "Выйти",
    search: "Поиск…",
    vault: "Vault",
    loading: "Загрузка…",
  },
  admin: {
    title: "Панель обновления моделей",
    unlock: "Открыть",
    runWatch: "Проверить сейчас",
    approve: "Подтвердить и сменить API",
    dismiss: "Отклонить",
    pending: "Ожидают подтверждения",
    activeEndpoints: "Активные endpoint’ы",
    coreSystem: "Ядро системы",
    currency: "Валюта",
    engine: "Движок",
    vaultFee: "Повторная загрузка Vault",
    status: "Статус",
    ready: "Готово",
    needsKeys: "Нужны ключи",
    secretPlaceholder: "Admin-секрет",
    analyticsEyebrow: "Админ · Финансы",
    analyticsTitle: "Аналитика и финансы",
    analyticsSubtitle:
      "Выручка, затраты API, поток NC и продажи пакетов за выбранный период.",
    filterToday: "Сегодня",
    filter5Days: "5 дней",
    filterWeek: "1 неделя",
    filterMonth: "1 месяц",
    filterCustom: "Свой период",
    applyRange: "Применить",
    totalRevenue: "Выручка",
    netProfit: "Чистая прибыль",
    activePayingUsers: "Платящие пользователи",
    lifetimePaying: "Всего",
    totalNcBalance: "Суммарный баланс NC",
    totalNcBalanceHint: "Непогашенные обязательства кошельков",
    apiOverhead: "Оценка затрат API",
    ncIssued: "Выдано NC",
    ncConsumed: "Потрачено NC",
    dailyIncome: "Дневная выручка",
    packBreakdown: "Продажи по пакетам",
    recentTransactions: "Последние транзакции",
    colTime: "Время",
    colUser: "Пользователь",
    colPack: "Пакет",
    colAmount: "Сумма",
    colNc: "NC",
    orders: "заказов",
    emptyTransactions: "В этом периоде нет оплаченных транзакций.",
    emptyChart: "В этом периоде нет продаж.",
    loadError: "Не удалось загрузить аналитику",
    modelsLink: "Обновление моделей",
  },
};

export const dictionary: Record<AppLocale, Dictionary> = { uz, ru, en };

export function resolveAppLocale(code: string | null | undefined): AppLocale {
  if (code === "uz" || code === "ru" || code === "en") return code;
  return "en";
}

export function getDictionary(locale: string | null | undefined): Dictionary {
  return dictionary[resolveAppLocale(locale)];
}
