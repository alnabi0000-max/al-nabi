# Alnabiy — AI Video Platform (Next.js)

Brend: **Alnabiy** · Watermark: **Alnabiy Preview** · Valyuta: **Alnabiy Coins**

## Ishga tushirish

```bash
cd al-nabi
cp .env.example .env
npm install
npx prisma generate
npm run dev
```

Google orqali ro‘yxatdan o‘tish: `docs/google-oauth-setup.md` (Google Cloud
OAuth client + Supabase Google provider + Redirect URL). Client ID/Secret
faqat Supabase dashboardga yoziladi.

## 31–60 Qadamlar — Fayl xaritasi

### Blok 1 — Database, Keys, i18n, Store
| Fayl | Vazifa |
|------|--------|
| `prisma/schema.prisma` | User, alnabiyKey, alnabiyCoins, Session, Referral |
| `src/app/api/auth/verify-key/route.ts` | Email + Key → seans/balans tiklash |
| `src/lib/i18n/locales.ts` | 20 til dictionary |
| `src/components/LanguageDropdown.tsx` | Yuqori o'ng til menyusi |
| `src/components/CoinStore.tsx` | 5 paket + 3D oltin sandiq |
| `src/app/api/referral/reward/route.ts` | +2000 referral |
| `src/app/profile/page.tsx` | Key login + Referral link |

### Blok 2 — Multi-Provider & Studio
| Fayl | Vazifa |
|------|--------|
| `src/app/api/generate/route.ts` | Replicate/Fal/Luma/Runway gateway |
| `src/lib/video-provider.ts` | Sifat → model yo'naltirish |
| `src/app/generate/page.tsx` | Studio UI (prompt, dropzone, seconds, quality) |
| `src/app/api/script/*` | Script-to-Movie LLM + pipeline |
| `src/lib/ffmpeg-worker.ts` | FFmpeg stitch |
| `src/components/IdentityLock.tsx` | InstantID yuz qulfi |
| `src/components/MotionBrush.tsx` | Harakat cho'tkasi |
| `src/components/RegionalEditor.tsx` | Inpaint / Outpaint |

### Blok 3 — Cyber Shield & UI
| Fayl | Vazifa |
|------|--------|
| `src/components/SecurePlayer.tsx` | 60fps Canvas watermark + OBS + blur |
| `src/components/CyberShield.tsx` | F12/PrintScreen/Halol/BAN |
| `src/lib/halol.ts` | Regex filtr |
| `src/components/MobileNav.tsx` | iPhone Bottom Nav (4 tugma) |
| `src/context/MasterControllerContext.tsx` | Markaziy zanjir |

## Rasmiy NC paketlar

| Paket | Narx | Asosiy NC | Bonus | Jami NC | Taxminiy videolar (20 NC) |
|-------|------|-----------|-------|---------|---------------------------|
| Starter Package | $20 | 2 000 | +5% (100) | 2 100 | 105 |
| Pro Package | $40 | 4 000 | +10% (400) | 4 400 | 220 |
| Creator Package | $60 | 6 000 | +15% (900) | 6 900 | 345 |
| Business Package | $80 | 8 000 | +20% (1 600) | 9 600 | 480 |
| Studio Package | $100 | 10 000 | +25% (2 500) | 12 500 | 625 |

Balans interfeysida faqat **NC** (dollar yo'q). Rasmiy narxlar Coin Store kartochkalarida.
