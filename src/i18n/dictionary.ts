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
    gateEyebrow: string;
    gateTitle: string;
    gateSubtitle: string;
    gatePlaceholder: string;
    gateSubmit: string;
    gateBusy: string;
    gateInvalid: string;
    gateRateLimited: string;
    settingsEyebrow: string;
    settingsTitle: string;
    settingsSubtitle: string;
    passcodeSection: string;
    currentPasscode: string;
    newPasscode: string;
    confirmPasscode: string;
    passcodeHint: string;
    passcodeSaved: string;
    passcodeMismatch: string;
    passcodeTooShort: string;
    showPasscode: string;
    hidePasscode: string;
    navAnalytics: string;
    navLedger: string;
    navUsers: string;
    navJobs: string;
    navModels: string;
    navSettings: string;
    ledgerEyebrow: string;
    ledgerTitle: string;
    ledgerSubtitle: string;
    incomeUsd: string;
    expenseUsd: string;
    refundUsd: string;
    cashflow: string;
    ncIn: string;
    ncOut: string;
    paidOrders: string;
    refundedOrders: string;
    ledgerByKind: string;
    ledgerEntries: string;
    purchasesTitle: string;
    colType: string;
    colDelta: string;
    colReason: string;
    colBalance: string;
    colStatus: string;
    emptyLedger: string;
    emptyPurchases: string;
    openLedger: string;
    usersEyebrow: string;
    usersTitle: string;
    usersSubtitle: string;
    usersSearch: string;
    colRole: string;
    colPlan: string;
    colCreated: string;
    colLastLogin: string;
    roleUser: string;
    roleModerator: string;
    roleAdmin: string;
    statusActive: string;
    statusWarning: string;
    statusBanned: string;
    confirmBan: string;
    adjustNc: string;
    adjustNcHint: string;
    adjustNcReason: string;
    applyAction: string;
    actionSaved: string;
    actionError: string;
    jobsEyebrow: string;
    jobsTitle: string;
    jobsSubtitle: string;
    jobsSearch: string;
    colJobType: string;
    colCost: string;
    colError: string;
    filterAll: string;
    emptyUsers: string;
    emptyJobs: string;
    prevPage: string;
    nextPage: string;
    kindSignupGrant: string;
    kindPurchase: string;
    kindCharge: string;
    kindBonus: string;
    kindReferral: string;
    kindRollback: string;
    kindAdjustment: string;
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
    gateEyebrow: "Restricted",
    gateTitle: "Admin Master Passcode",
    gateSubtitle: "Enter the master access passcode to continue.",
    gatePlaceholder: "Master passcode",
    gateSubmit: "Unlock",
    gateBusy: "Verifying…",
    gateInvalid: "Invalid passcode",
    gateRateLimited: "Too many attempts. Try again later.",
    settingsEyebrow: "Admin",
    settingsTitle: "Security & Settings",
    settingsSubtitle:
      "Change the master access passcode used to open this panel.",
    passcodeSection: "Master access passcode",
    currentPasscode: "Current passcode",
    newPasscode: "New passcode",
    confirmPasscode: "Confirm new passcode",
    passcodeHint:
      "At least 8 characters. Changing it signs out other admin sessions.",
    passcodeSaved: "Passcode updated",
    passcodeMismatch: "New passcode and confirmation do not match",
    passcodeTooShort: "Passcode must be at least 8 characters",
    showPasscode: "Show passcode",
    hidePasscode: "Hide passcode",
    navAnalytics: "Analytics",
    navLedger: "Cash flow",
    navUsers: "Users",
    navJobs: "Generations",
    navModels: "Models",
    navSettings: "Settings",
    ledgerEyebrow: "Admin · Finance",
    ledgerTitle: "Income & expenses",
    ledgerSubtitle:
      "Paid orders, refunds, estimated API cost, and NC in/out for the selected window.",
    incomeUsd: "Income",
    expenseUsd: "Expenses",
    refundUsd: "Refunds",
    cashflow: "Cash flow",
    ncIn: "NC in",
    ncOut: "NC out",
    paidOrders: "paid orders",
    refundedOrders: "refunded orders",
    ledgerByKind: "NC by type",
    ledgerEntries: "NC ledger",
    purchasesTitle: "Payments",
    colType: "Type",
    colDelta: "Change",
    colReason: "Reason",
    colBalance: "Balance",
    colStatus: "Status",
    emptyLedger: "No ledger activity in this window.",
    emptyPurchases: "No payments in this window.",
    openLedger: "Income & expenses",
    usersEyebrow: "Admin · Accounts",
    usersTitle: "Users",
    usersSubtitle: "Search accounts, change role or status, and adjust NC.",
    usersSearch: "Search by email",
    colRole: "Role",
    colPlan: "Plan",
    colCreated: "Created",
    colLastLogin: "Last login",
    roleUser: "User",
    roleModerator: "Moderator",
    roleAdmin: "Admin",
    statusActive: "Active",
    statusWarning: "Warning",
    statusBanned: "Banned",
    confirmBan: "Ban this user and zero their NC?",
    adjustNc: "Adjust NC",
    adjustNcHint: "+ add / − deduct",
    adjustNcReason: "Reason (optional)",
    applyAction: "Apply",
    actionSaved: "Saved",
    actionError: "Action failed",
    jobsEyebrow: "Admin · Jobs",
    jobsTitle: "Generations",
    jobsSubtitle: "Recent AI jobs, status, cost, and errors.",
    jobsSearch: "Search by email",
    colJobType: "Type",
    colCost: "Cost",
    colError: "Error",
    filterAll: "All",
    emptyUsers: "No users found.",
    emptyJobs: "No jobs found.",
    prevPage: "Previous",
    nextPage: "Next",
    kindSignupGrant: "Signup grant",
    kindPurchase: "Purchase",
    kindCharge: "Charge",
    kindBonus: "Bonus",
    kindReferral: "Referral",
    kindRollback: "Rollback",
    kindAdjustment: "Adjustment",
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
    gateEyebrow: "Cheklangan",
    gateTitle: "Admin Master Passcode",
    gateSubtitle: "Davom etish uchun master kirish parolini kiriting.",
    gatePlaceholder: "Master parol",
    gateSubmit: "Ochish",
    gateBusy: "Tekshirilmoqda…",
    gateInvalid: "Noto‘g‘ri parol",
    gateRateLimited: "Urinishlar ko‘p. Keyinroq qayta urinib ko‘ring.",
    settingsEyebrow: "Admin",
    settingsTitle: "Xavfsizlik va Sozlamalar",
    settingsSubtitle:
      "Ushbu panelni ochish uchun ishlatiladigan master kirish parolini o‘zgartiring.",
    passcodeSection: "Master kirish paroli",
    currentPasscode: "Joriy parol",
    newPasscode: "Yangi parol",
    confirmPasscode: "Yangi parolni tasdiqlang",
    passcodeHint:
      "Kamida 8 belgi. O‘zgartirish boshqa admin sessiyalarini yopadi.",
    passcodeSaved: "Parol yangilandi",
    passcodeMismatch: "Yangi parol va tasdiq mos kelmadi",
    passcodeTooShort: "Parol kamida 8 belgidan iborat bo‘lishi kerak",
    showPasscode: "Parolni ko‘rsatish",
    hidePasscode: "Parolni yashirish",
    navAnalytics: "Analitika",
    navLedger: "Kirim-chiqim",
    navUsers: "Foydalanuvchilar",
    navJobs: "Generatsiyalar",
    navModels: "Modellar",
    navSettings: "Sozlamalar",
    ledgerEyebrow: "Admin · Moliya",
    ledgerTitle: "Kirim-chiqim",
    ledgerSubtitle:
      "Tanlangan davr uchun tushum, qaytarim, API xarajati va NC oqimi.",
    incomeUsd: "Kirim",
    expenseUsd: "Chiqim",
    refundUsd: "Qaytarim",
    cashflow: "Kirim-chiqim",
    ncIn: "Kirim NC",
    ncOut: "Chiqim NC",
    paidOrders: "to‘langan buyurtma",
    refundedOrders: "qaytarilgan buyurtma",
    ledgerByKind: "NC turlari bo‘yicha",
    ledgerEntries: "NC jurnal",
    purchasesTitle: "To‘lovlar",
    colType: "Tur",
    colDelta: "O‘zgarish",
    colReason: "Sabab",
    colBalance: "Qoldiq",
    colStatus: "Holat",
    emptyLedger: "Bu davrda jurnal yozuvi yo‘q.",
    emptyPurchases: "Bu davrda to‘lov yo‘q.",
    openLedger: "Kirim-chiqim",
    usersEyebrow: "Admin · Hisoblar",
    usersTitle: "Foydalanuvchilar",
    usersSubtitle: "Qidirish, rol, holat va NC balansini boshqarish.",
    usersSearch: "Email bo‘yicha qidirish",
    colRole: "Rol",
    colPlan: "Tarif",
    colCreated: "Yaratilgan",
    colLastLogin: "So‘nggi kirish",
    roleUser: "Foydalanuvchi",
    roleModerator: "Moderator",
    roleAdmin: "Admin",
    statusActive: "Faol",
    statusWarning: "Ogohlantirish",
    statusBanned: "Bloklangan",
    confirmBan: "Bu foydalanuvchini bloklab, NC ni nol qilasizmi?",
    adjustNc: "NC tuzatish",
    adjustNcHint: "+ qo‘shish / − ayirish",
    adjustNcReason: "Sabab (ixtiyoriy)",
    applyAction: "Qo‘llash",
    actionSaved: "Saqlandi",
    actionError: "Amal bajarilmadi",
    jobsEyebrow: "Admin · Ishlar",
    jobsTitle: "Generatsiyalar",
    jobsSubtitle: "So‘nggi AI ishlar, holat, narx va xatolar.",
    jobsSearch: "Email bo‘yicha qidirish",
    colJobType: "Tur",
    colCost: "Narx",
    colError: "Xato",
    filterAll: "Hammasi",
    emptyUsers: "Foydalanuvchi topilmadi.",
    emptyJobs: "Ish topilmadi.",
    prevPage: "Oldingi",
    nextPage: "Keyingi",
    kindSignupGrant: "Ro‘yxatdan o‘tish",
    kindPurchase: "Sotib olish",
    kindCharge: "Sarf",
    kindBonus: "Bonus",
    kindReferral: "Referal",
    kindRollback: "Qaytarish",
    kindAdjustment: "Tuzatish",
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
    gateEyebrow: "Ограничено",
    gateTitle: "Admin Master Passcode",
    gateSubtitle: "Введите мастер-пароль доступа, чтобы продолжить.",
    gatePlaceholder: "Мастер-пароль",
    gateSubmit: "Открыть",
    gateBusy: "Проверка…",
    gateInvalid: "Неверный пароль",
    gateRateLimited: "Слишком много попыток. Попробуйте позже.",
    settingsEyebrow: "Админ",
    settingsTitle: "Безопасность и настройки",
    settingsSubtitle:
      "Смените мастер-пароль, которым открывается эта панель.",
    passcodeSection: "Мастер-пароль доступа",
    currentPasscode: "Текущий пароль",
    newPasscode: "Новый пароль",
    confirmPasscode: "Подтвердите новый пароль",
    passcodeHint:
      "Не менее 8 символов. Смена пароля завершает другие админ-сессии.",
    passcodeSaved: "Пароль обновлён",
    passcodeMismatch: "Новый пароль и подтверждение не совпадают",
    passcodeTooShort: "Пароль должен содержать не менее 8 символов",
    showPasscode: "Показать пароль",
    hidePasscode: "Скрыть пароль",
    navAnalytics: "Аналитика",
    navLedger: "Приход-расход",
    navUsers: "Пользователи",
    navJobs: "Генерации",
    navModels: "Модели",
    navSettings: "Настройки",
    ledgerEyebrow: "Админ · Финансы",
    ledgerTitle: "Приход и расход",
    ledgerSubtitle:
      "Оплаты, возвраты, оценка затрат API и поток NC за выбранный период.",
    incomeUsd: "Приход",
    expenseUsd: "Расход",
    refundUsd: "Возвраты",
    cashflow: "Приход-расход",
    ncIn: "Вход NC",
    ncOut: "Выход NC",
    paidOrders: "оплаченных заказов",
    refundedOrders: "возвращённых заказов",
    ledgerByKind: "NC по типам",
    ledgerEntries: "Журнал NC",
    purchasesTitle: "Платежи",
    colType: "Тип",
    colDelta: "Изменение",
    colReason: "Причина",
    colBalance: "Остаток",
    colStatus: "Статус",
    emptyLedger: "В этом периоде нет записей журнала.",
    emptyPurchases: "В этом периоде нет платежей.",
    openLedger: "Приход-расход",
    usersEyebrow: "Админ · Аккаунты",
    usersTitle: "Пользователи",
    usersSubtitle: "Поиск, роль, статус и корректировка NC.",
    usersSearch: "Поиск по email",
    colRole: "Роль",
    colPlan: "Тариф",
    colCreated: "Создан",
    colLastLogin: "Последний вход",
    roleUser: "Пользователь",
    roleModerator: "Модератор",
    roleAdmin: "Админ",
    statusActive: "Активен",
    statusWarning: "Предупреждение",
    statusBanned: "Заблокирован",
    confirmBan: "Заблокировать пользователя и обнулить NC?",
    adjustNc: "Корректировка NC",
    adjustNcHint: "+ начислить / − списать",
    adjustNcReason: "Причина (необязательно)",
    applyAction: "Применить",
    actionSaved: "Сохранено",
    actionError: "Не удалось выполнить",
    jobsEyebrow: "Админ · Задачи",
    jobsTitle: "Генерации",
    jobsSubtitle: "Последние AI-задачи, статус, стоимость и ошибки.",
    jobsSearch: "Поиск по email",
    colJobType: "Тип",
    colCost: "Стоимость",
    colError: "Ошибка",
    filterAll: "Все",
    emptyUsers: "Пользователи не найдены.",
    emptyJobs: "Задачи не найдены.",
    prevPage: "Назад",
    nextPage: "Далее",
    kindSignupGrant: "Бонус регистрации",
    kindPurchase: "Покупка",
    kindCharge: "Списание",
    kindBonus: "Бонус",
    kindReferral: "Реферал",
    kindRollback: "Откат",
    kindAdjustment: "Корректировка",
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
