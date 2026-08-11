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

## Coin Store paketlar

| Paket | Narx | Coins | Bonus |
|-------|------|-------|-------|
| Starter Hook | $5 | 1 000 | — |
| Pro Creator | $25 | 5 500 | +500 |
| Hollywood Studio | $50 | 12 000 | +1 000 |
| Director Choice | $80 | 20 000 | +2 000 |
| Infinite Alnabiy | $100 | 25 000 | +3 500 |

Balans interfeysida faqat **Alnabiy Coins** (dollar yo'q). Real narx faqat Coin Store kartochkalarida.
