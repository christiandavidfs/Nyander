# Expo HAS CHANGED
Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Nyander — Givelify + Tinder para mascotas
Convertir ayuda en negocio. Stack: Expo 56 / TS 6 / React 19 / Expo Router / Supabase / PayPal REST / Reanimated.

## Modelo de negocio (Givelify-inspired)
- 2-tap giving, recurring 2.3x valor, text-to-give, campañas, analytics.
- Fees: 10% platform (PLATFORM_FEE_PERCENT server/index.js) + negocios $15/mo / $150/yr.
- Dos productos separados: **Apadrinar** (adopter→gato recurring, `sponsorships`, botón en cards, `app/sponsorships.tsx` para gestionar) y **Aliados** (directorio B2B rankeado, click tracking, trial 14d).

## Priority List
### P0 — Crítico (bloquea negocio)
1. RLS `profiles.id` ambiguo `000_super_schema.sql:345,361` + `fix_missing_policies.sql` + rotar anon key `.env` + `.gitignore` fix
2. Webhook `server/index.js:497` capture vs order ID + idempotencia `event.id` + `likes` UPDATE RLS + `PLATFORM_FEE` NaN guard
3. `server/paypal.js:98` reutilizar product/plan (cache) — no crear por cada subscription
4. Dummy payments `*.demo@nyander.app` en `server/index.js` + `SponsorButton.tsx`/`DonateButton.tsx` mock
5. `app/cat/[id].tsx:78` maybeSingle + `app/messages/[id].tsx:54` init() — verificado

### P1 — Monetización
6. Recurring donations UI `DonateButton.tsx` monthly toggle → `create-subscription` interval month
7. Campaigns tabla (shelter_id, title, goal, raised) + dashboard analytics `sponsor_invoices`
8. Payouts webhook `PAYOUTS-ITEM` + `payout_status`
9. Text-to-give QR `nyander.app/c/:id`

### P2 — Tinder/Happn features
10. Video upload fix `app/cats.tsx:550` + `VideoPlayer.tsx` controls + 50MiB `config.toml:115`
11. Temperament rating `cats` JSONB `friendly/playful/calm` + rate tras like + filtro
12. Filtros avanzados + paginación `app/cats.tsx:117` (hoy `select *` sin limit) + search bar
13. Happn "Crossed paths" `lib/location.ts` + `StaticMap.tsx` — cats <1km cruzados hoy, bonus XP
14. Gamificación: `profiles.score` → XP, streaks, badges, quests semanales, Top Picks

### P3 — Pulido
15. Design system `constants/Colors.ts`, split `app/cats.tsx` 1434 LOC, `middleware/rateLimit.js` deps, Node 18→20, tests

## Reglas
- `supabase/migrations/000_super_schema.sql` = schema único (DROP+CREATE), `999_seed_data.sql` = seeds (18 países + 8 sponsors)
- `supabase/fix_missing_policies.sql` = hotfix RLS sin DROP masivo
- Sponsors es un LISTING con `owner_id`, no un rol: registro solo ofrece `usuario`/`centro`; `sponsor` en DB queda como legacy. Cualquier cuenta puede crear su listing desde Sponsors.
- `isSupabaseConfigured` gating + `maybeSingle()` en vez de `single()` para PGRST116
- `likes` upsert `onConflict: 'cat_id, user_id'` + UPDATE policy, dedup local `likedIds`/`passedIds` en `cats.tsx`
- Like acredita al shelter del gato (`increment_shelter_earnings` con `shelter_id` del cat), no al usuario que da like
- `messages/[id].tsx` init() debe llamarse explícitamente, try/catch + finally(setLoading)
- Mapas: `StaticMap` con spinner + prefetch en native; deck muestra mapa al obtener ubicación; `crossed.tsx` sin encuentros fake, con filtro por país + pull-to-refresh
- PayPal: Orders v2 + Subscriptions, return_url/cancel_url parametrizables, webhook raw body para verify
