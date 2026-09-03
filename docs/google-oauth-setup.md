# Google orqali ro‘yxatdan o‘tish — qadam-baqadam

Al-Nabi Google tugmasi **Supabase Auth** orqali ishlaydi. Google Client ID va
Secret **faqat Supabase dashboard**ga yoziladi — ularni `.env` ga qo‘ymang.

Brauzer oqimi:

1. Foydalanuvchi **Google bilan kirish** ni bosadi.
2. Sayt uni Supabase → Google hisob tanlash sahifasiga yuboradi.
3. Google `https://<PROJECT_REF>.supabase.co/auth/v1/callback` ga qaytaradi.
4. Supabase brauzerni `https://<domen>/auth/callback` ga qaytaradi.
5. Server sessiyani cookie ga yozadi, Prisma da hisob ochadi (yoki yangilaydi)
   va kabinetga yo‘naltiradi.

---

## 0. Oldindan kerak

- Google hisob (masalan `alnabi0000@gmail.com`)
- Ishlaydigan Supabase loyihasi
- Sayt manzili: lokal uchun `http://localhost:3000`, production uchun
  `https://<domen>`
- `.env` / Vercel da `AUTH_MODE=supabase`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 1. Google Cloud — OAuth client

1. [Google Cloud Console](https://console.cloud.google.com/) ni oching.
2. Yuqoridagi loyiha tanlagichdan **yangiloyiha** yarating (masalan `al-nabi`)
   yoki mavjudini tanlang.
3. Chap menyu: **APIs & Services → OAuth consent screen**.
4. User Type: tashqi foydalanuvchilar uchun **External**, **Create**.
5. App name: `Al-Nabi`. User support email va Developer contact email — o‘z
   Gmail manzilingiz.
6. **Save and Continue**. Scopes qadamida default yetarli (`email`, `profile`,
   `openid` ni Supabase so‘raydi). Test users ga o‘z Gmail ingizni qo‘shing
   (app **Testing** holatida bo‘lsa, faqat shu ro‘yxatdagi hisoblar kira oladi).
7. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
8. Application type: **Web application**. Name: `Al-Nabi Web`.
9. **Authorized JavaScript origins** (har birini alohida qator):

   ```
   http://localhost:3000
   https://<PROJECT_REF>.supabase.co
   https://<domen>
   ```

10. **Authorized redirect URIs** — faqat Supabase callback. Bu eng muhim
    qator. **Saytingizning `/auth/callback` manzilini bu yerga yozmang.**

    ```
    https://<PROJECT_REF>.supabase.co/auth/v1/callback
    ```

    `<PROJECT_REF>` ni Supabase → **Project Settings → General → Reference ID**
    dan oling. URL `https://abcdxyz.supabase.co` bo‘lsa, callback ham shu host.

11. **Create**. **Client ID** (`….apps.googleusercontent.com`) va **Client
    secret** ni nusxalang. Secret keyin ko‘rinmaydi.

---

## 2. Supabase — Google provider

1. [Supabase Dashboard](https://supabase.com/dashboard) → o‘z loyihangiz.
2. **Authentication → Sign In / Providers → Google**.
3. **Enable Google** ni yoqing.
4. Google Cloud dagi **Client ID** va **Client Secret** ni shu yerga qo‘ying.
5. **Skip nonce check** ni odatda o‘chiriq qoldiring (yoqilgan holda ham ishlaydi,
   lekin xavfsizlik pastroq).
6. **Save**.

### URL Configuration

**Authentication → URL Configuration**:

| Maydon | Qiymat |
|--------|--------|
| Site URL | Production: `https://<domen>` · Lokal: `http://localhost:3000` |
| Redirect URLs | quyidagi ro‘yxat |

Redirect URLs (har biri alohida qator):

```
http://localhost:3000/auth/callback
https://<domen>/auth/callback
alnabi://auth/callback
```

Magic Link uchun `?next=` ham bo‘lishi mumkin, shuning uchun wildcard ham
qo‘shing:

```
http://localhost:3000/auth/callback**
https://<domen>/auth/callback**
```

### Bir email — bitta hisob

Agar foydalanuvchi avval email kod / parol bilan ro‘yxatdan o‘tgan bo‘lsa,
keyin Google ni bossа, Supabase yangi UUID ochishi mumkin. Buni oldini olish
uchun **Authentication → Providers** (yoki **User Management**) da **Automatic
account linking** ni yoqing: tasdiqlangan bir xil email bitta `auth.users`
qatoriga birikadi.

---

## 3. Al-Nabi environment

`.env.local` (lokal) va Vercel / hosting secretlari:

```
AUTH_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_SECRET=<kamida-32-belgili-tasodifiy-satr>
```

Production da `NEXT_PUBLIC_APP_URL=https://<domen>`.

Google Client ID / Secret ni bu yerga **yozmang**.

Tekshiruv:

```bash
npm run launch:check
```

---

## 4. Qanday sinash

1. `npm run dev` — `http://localhost:3000`.
2. Kirish oynasini oching (**Tezkor kirish**).
3. **Google bilan kirish** ni bosing.
4. Google hisobni tanlang va ruxsat bering.
5. Siz `/profile?tab=kabinet` ga qaytasiz, yashil xabar chiqadi, email
   kabinetda ko‘rinadi.

Birinchi muvaffaqiyatli Google kirish yangi Prisma `User` ochadi, boshlang‘ich
NC beradi va (Resend sozlangan bo‘lsa) xush kelibsiz xat yuboradi.

---

## 5. Tez-tez uchraydigan xatolar

| Belgisi | Sabab | Yechim |
|---------|-------|--------|
| `redirect_uri_mismatch` Google sahifasida | Google Cloud dagi redirect URI noto‘g‘ri | Faqat `https://<PROJECT_REF>.supabase.co/auth/v1/callback` |
| Tugma «Supabase Auth sozlang» | `NEXT_PUBLIC_SUPABASE_*` bo‘sh yoki placeholder | Haqiqiy URL va anon key |
| `Google kirish hali yoqilmagan` | Provider o‘chiq yoki secret xato | Supabase → Google → Enable + to‘g‘ri secret |
| `Google ruxsati bekor qilindi` | Foydalanuvchi Cancel bosgan | Qayta urinish |
| `Bu email boshqa usul bilan…` | Shu Gmail allaqachon OTP/parol hisobi | Avval email bilan kiring yoki Automatic linking |
| Qaytib kelganda yana login formasi | Session cookie yozilmadi | HTTPS, Site URL, Redirect URL ni tekshiring |
| Testing app: `Access blocked` | Gmail test users da yo‘q | Consent screen → Test users |

App ni hamma ochishi uchun OAuth consent screen ni **In production** ga
o‘tkazing (Google tekshiruvi kerak bo‘lishi mumkin).

---

## 6. Kod qayerda

| Fayl | Vazifa |
|------|--------|
| `src/components/auth/SocialAuthButtons.tsx` | Google tugmasi, PKCE, `openid email profile` |
| `src/app/auth/callback/route.ts` | Kodni sessiyaga almashtirish + Prisma onboarding |
| `src/lib/auth/identity.ts` | Google email / ism / rasmni yig‘ish |
| `src/lib/auth/oauth-redirect.ts` | Toza `/auth/callback` + `next` cookie |
| `src/lib/auth/ensure-user.ts` | Birinchi Google kirishda User + NC grant |
