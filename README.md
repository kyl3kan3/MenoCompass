# Meno Compass

A private, offline-capable PWA for women in perimenopause and beyond. Tracker first, with an
evidence-graded reference library behind it.

- **No account, no server, no analytics, no network requests.** Data lives in the browser's
  local storage on the user's device.
- **Works offline** once installed, via a service worker that caches the app shell.
- **One file, no dependencies.** `index.html` contains all CSS and JS inline. No CDN, no build
  step needed to run it.

---

## What's in the box

```
dist/                      ← deploy this folder
  index.html               the whole app (263 KB, everything inlined)
  manifest.webmanifest     PWA manifest (name, icons, shortcuts)
  sw.js                    service worker (offline shell cache)
  icons/                   192, 512, maskable 512, apple-touch, favicon

src/                       ← edit these, then rebuild
  styles.css               design system (light + dark)
  content-a.js             symptom library, treatment landscape, supplements
  content-b.js             staging, diet, exercise, weight, skin, sleep, mind,
                           sexual health, screening, red flags, sources
  app-core.js              storage, data model, charts, insights engine
  app-views.js             views, tools, router
  manifest.webmanifest
  sw.js

build.py                   assembles src/ → dist/index.html
make_icons.py              regenerates the icon set
test.js                    Playwright end-to-end suite (~140 assertions)
```

## Running it

**Locally, no server:** open `dist/index.html` in a browser. Everything works except the
service worker and install prompt, which need HTTP(S).

**Locally, with a server** (needed to test install/offline):

```bash
cd dist && python3 -m http.server 8080
# then open http://localhost:8080
```

## Deploying

Any static host works. It must be served over **HTTPS** for the service worker and the
"Add to Home Screen" install prompt to function.

**Netlify / Vercel / Cloudflare Pages** — drag the `dist` folder onto the dashboard, or point
the project at the repo with `dist` as the publish directory. No build command.

**GitHub Pages:**

```bash
git init && git add . && git commit -m "Meno Compass"
git branch -M main
git remote add origin git@github.com:USERNAME/meno-compass.git
git push -u origin main
# Settings → Pages → Source: main, folder: /dist
```

**Any web host** — upload the contents of `dist/` to a folder. Paths are all relative, so it
works from a subdirectory (`example.com/meno/`) as well as a root domain.

### Installing it as an app

On the deployed URL: iPhone/iPad — Share → *Add to Home Screen*. Android — the browser offers
*Install app*, or use the ⋮ menu. Desktop Chrome/Edge — the install icon in the address bar.
After installing, it opens full-screen with no browser chrome and works with no connection.

## Rebuilding after edits

```bash
python3 build.py      # src/ → dist/index.html
node test.js          # run the test suite (needs: npm install playwright)
```

`build.py` inlines `styles.css` and the four JS files, in this order:
`content-a.js`, `content-b.js`, `app-core.js`, `app-views.js`. They share globals, so the order
matters.

**Important:** after changing anything in `dist/`, bump `CACHE` in `dist/sw.js`
(`meno-compass-v1` → `v2`). Otherwise returning users keep the old cached version until the
background refresh catches up on their second launch.

## Data model

Everything lives under the single localStorage key `menocompass.v1`:

```js
{
  v: 1,
  profile:  { name, birthYear, region, units,
              uterus:   'intact'|'hyst'|'ablation'|'unknown',
              ovaries:  'kept'|'one'|'both'|'unknown',
              lastPeriod, surgeryDate, bone,
              proteinGpk, weightGoal, waistGoal, theme, stage, onboarded },
  entries:  { "2026-07-29": { hf, ns, inBedH, sleepH, sym:{…}, wt, waist,
                              bleed, act:{res,bal,pf,aero}, nut:{prot,cal,fib,alc,caf}, notes } },
  screening:{ dxa:{last}, mammo:{last}, … },
  scores:   [ {date, type:'phq9'|'gad7', score, band} ],
  trigger:  { active, item, start } | null
}
```

`uterus` and `ovaries` are **separate fields on purpose.** A hysterectomy can leave both ovaries
in place, and ovaries are sometimes removed with the uterus left — the two have completely
different consequences, and collapsing them into one field produces wrong advice. Three helpers
in `app-core.js` derive everything downstream from them: `hasUterus()`, `periodsPossible()` and
`surgicalMenopause()`. They gate the staging questions, the last-period vs. surgery-date field,
the bleeding copy on Today, the endometrial-protection note in the treatment module, and two
insight rules. Records written by an earlier single-field version are migrated automatically.

Weight is always stored in **kg** and waist in **cm**, regardless of the display unit — so
switching units never mutates stored data. If localStorage is blocked (private mode, sandboxed
iframe), the app falls back to in-memory storage and tells the user their entries won't survive
a reload.

Export/import is plain JSON round-trip; CSV export is one row per day plus a questionnaire block.

## Editorial rules the content follows

These are deliberate and worth preserving if you edit the copy:

1. **Match each intervention to the outcome it actually has evidence for.** The Menopause
   Society does not recommend exercise, yoga, mindfulness, paced breathing, cooling or trigger
   avoidance *for hot flashes specifically*. The app scopes that finding narrowly every time it
   appears, and never implies those things are useless generally — they have strong evidence for
   mood, sleep, bone, heart health and muscle.
2. **Every drug mention carries its safety line.** Fezolinetant without its liver-monitoring
   schedule is unsafe content.
3. **Absolute risk, not relative risk.** "80% higher" is meaningless; "+8 per 1,000 over five
   years" is not.
4. **Say what we couldn't verify.** The *Sources* module lists what was deliberately left out
   and why. Several widely circulated figures are on that list.
5. **Flag US/UK divergence** rather than silently picking a side. The region setting drives
   region-specific callouts in the treatment, diet, supplements and screening modules.
6. **Report racial and ethnic differences where the data exist.** Symptom duration, premature
   menopause prevalence, endometrial cancer incidence and ultrasound false-negative rates all
   differ, and omitting them produces content that is least accurate for the women at highest
   risk.
7. **No unvalidated cut-offs.** The symptom burden score is presented as a direction-over-time
   measure with no severity bands, because none has been validated for that item set.
8. **Never assume a bleeding pattern exists.** After a hysterectomy or ablation, or on
   period-suppressing contraception, the criterion every staging system depends on is
   unavailable. The app says so and routes to what still works, rather than asking about periods
   that aren't there or forcing a stage it can't support.

## Content currency

Guideline content was compiled and reviewed in **July 2026** against primary sources: The
Menopause Society, NICE NG23, ACOG, AUA/SUFU/AUGS, USPSTF, British Menopause Society, MHRA, FDA,
AHA, ESHRE, the Global Consensus on testosterone, AASM, NCCIH and the SWAN cohort. The full list
and the deliberate omissions are in the app's *Sources* module.

This field moved substantially in **November 2025** (FDA labelling), **March 2026** (NICE
fezolinetant appraisal) and **April 2026** (ACOG bleeding guidance). **Set a review cadence of no
more than six months.** When you review, the highest-value checks are: the FDA/MHRA labelling
position, the neurokinin antagonist approvals and monitoring requirements, the USPSTF screening
intervals, and the IMS 2025/2026 recommendations (which were paywalled during compilation and
never cited).

## Accessibility

Semantic buttons with `aria-pressed` / `aria-current`, every form control labelled, minimum 40 px
tap targets, visible focus rings, `prefers-reduced-motion` honoured, `prefers-color-scheme` for
theme with a manual override, and a print stylesheet for the clinician report.

## Not medical advice

The app provides general health education compiled from published clinical guidelines. It does
not diagnose, treat or prescribe. It is not a medical device and has not been reviewed by any
regulator. If you plan to distribute it publicly, get the disclaimer and privacy language
reviewed for your jurisdiction.

## Backup security

Backup restores now rebuild an allowlisted schema and discard presentation HTML and unknown fields. Stage results are recomputed from valid saved quiz answers; old backups with only a saved stage label may require retaking the stage quiz. Daily entries, notes, valid scores and settings are preserved. The checked-in standalone index contains the same security changes, and the service-worker cache version is bumped. Run `node --test security.test.cjs` for offline backup regression tests.
