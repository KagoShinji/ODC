# Prompt: Scroll Animation Enhancement (ODC public site)

Copy everything below the line into Claude Code (or Codex) from the repo root.

---

## Role

You are a senior design engineer adding scroll-driven animation to the public marketing site of this repo (React 19 + Vite 7 + Tailwind v4). Work with the code already here. Don't rebuild sections or change copy, layout, colors, or routing.

## Step 0: Install and load the skills

Use skills from **Agentic Awesome Skills** (https://github.com/sickn33/agentic-awesome-skills). Preview the install first, then install into the existing `.agents/skills` folder:

```bash
npx agentic-awesome-skills --path .agents/skills --skills scroll-experience,emil-design-eng,review-animations,fixing-motion-performance --dry-run
npx agentic-awesome-skills --path .agents/skills --skills scroll-experience,emil-design-eng,review-animations,fixing-motion-performance
```

Read each `SKILL.md` before you write any code, and follow them in this order:

| Skill | Use it for |
|---|---|
| `scroll-experience` | **Primary.** Scroll storytelling: pinning, parallax, scrubbed timelines, reveal choreography. |
| `emil-design-eng` | Craft: easing, durations, stagger rhythm, and restraint. |
| `fixing-motion-performance` | Animating only transform and opacity, no layout thrashing, and limits on scroll-linked blur. |
| `review-animations` | Final audit gate covering craft, performance, accessibility, and interaction quality. |

The repo also has local taste skills in `.agents/skills` (`design-taste-frontend`, `high-end-visual-design`, `gpt-taste`). Use them for visual judgment only. If a local skill conflicts with `fixing-motion-performance` or with accessibility, the performance and accessibility rules win.

## Current state (verify before changing)

- **Libraries:** `gsap` ^3.15 and `@gsap/react` are installed but **unused**. `framer-motion` ^12 is used widely as `motion as Motion`.
- **`src/pages/Home.jsx`:** Uses a shared `sectionMotion` preset (fade up, 36px, blur, `whileInView`, `once: true`). The sections are `#home` (hero), `#portfolio` (business showcase cards), `#partnership`, `#contact`, and `<ClientProofBento />`.
- **Other public pages:** `About`, `Services`, `Portfolio`, `Contact`, and `NotFound` (routes in `src/App.jsx` → `PublicSite`).
- **Section components:** `src/components/sections/*` (Services, Process, Portfolio, Testimonials, PricingPlans, TrustBar, ClientProofBento, Faq, About, Contact), plus `src/components/ui/Hero.jsx` and `src/components/layout/Navbar.jsx`. Navbar uses `scrollToSection()`, which must keep working.
- **Reduced motion:** `src/index.css` already has a `prefers-reduced-motion: reduce` block.

## Scope

**In scope:** Public pages only (`/`, `/about`, `/services`, `/portfolio`, `/contact`).

**Out of scope:** Don't touch `/odc/*` (admin), `/portal/*`, `/acceptance`, `/moa`, `/invoice`, or `/feedback`.

## Architecture rules

1. **Pick one engine per job.**
   - **Framer Motion:** Entrance reveals and hover/press micro-interactions, since the codebase already uses it.
   - **GSAP + ScrollTrigger via `useGSAP()`:** Scroll-*scrubbed* and *pinned* sequences only.
   - Don't animate the same element with both.
2. **Shared module.** Create `src/lib/motion.js` with shared easings, durations, variants (`fadeUp`, `stagger`), and a `useReducedMotionSafe` helper. Replace the duplicated inline presets (such as `sectionMotion` in `Home.jsx`) with imports.
3. **GSAP setup.** Register `ScrollTrigger` once. Scope every timeline with `useGSAP({ scope: ref })` so it cleans up on unmount and route change. Call `ScrollTrigger.refresh()` after images and fonts load.
4. **No new dependencies.** Ask before adding anything, including Lenis.

## Animation plan (adapt it to what you find)

1. **Hero (`#home`)**
   - Staggered headline reveal on load (split by line or word, mask-up, ≤ 900ms total).
   - While scrolling out, scrub subtle parallax: background layer at y 0→-80px and content opacity 1→0.6.
   - No pinning on mobile.
2. **Business showcase cards (`#portfolio`)**
   - Staggered card entrance (60–90ms stagger).
   - Preview images scale from 1.06 to 1 inside an `overflow:hidden` frame as they enter.
   - **Desktop (≥1024px) only:** Optional pinned horizontal-scroll gallery. Fall back to a normal grid below that width.
3. **Process / Services sections**
   - Steps reveal in sequence.
   - A progress line (`scaleY` or `scaleX` with `transform-origin`) scrubs with scroll.
4. **ClientProofBento**
   - Tiles reveal on a diagonal stagger.
   - Number stats count up once when 50% visible.
5. **Section headings site-wide:** One consistent reveal (clip/mask + 16–24px translate). No blur on scroll-scrubbed elements; blur is allowed only on one-shot reveals.
6. **Navbar**
   - Hides on scroll down and shows on scroll up, with a background/blur change after 40px.
   - Add a thin scroll-progress bar at the top.
   - Keep `scrollToSection()` offsets correct.
7. **Route changes:** Kill old ScrollTriggers, reset the scroll position, and play a short page-enter fade (≤ 300ms).

## Hard constraints

- **Properties:** Animate **only `transform` and `opacity`** (plus `clip-path` for masks). Never animate width, height, top, left, margin, or box-shadow during scroll.
- **Reduced motion:** With `prefers-reduced-motion: reduce`, remove all parallax, pinning, scrubbing, and count-ups. Content must appear immediately or with a ≤150ms opacity fade.
- **No hidden content:** If JS is slow or fails, all text must stay visible and readable. Hide nothing with CSS before JS takes over.
- **Mobile (<768px):** No pinning and no horizontal scroll hijacking. Keep only reveals.
- **Layout stability:** No layout shift (CLS ≈ 0), no horizontal page overflow, and no fight with native scroll. Keep scroll smoothing native.
- **Timing:** Most reveals take 0.5–0.9s. Use ease-out curves such as `[0.22, 1, 0.36, 1]`, `power3.out`, or `expo.out`. Nothing should bounce unless it's a press interaction.
- **Replay:** Reveals run once (`once: true`). Only scrubbed effects reverse.

## Verification (required before you report done)

1. Run `npm run lint` and `npm run build` with zero new errors or warnings.
2. Run `npm run dev` and check each public route in the browser at 375px, 768px, and 1440px. Confirm:
   - No horizontal overflow.
   - Navbar anchor links land correctly.
   - Navigating between routes back and forth leaves no stale triggers or console errors.
3. Emulate `prefers-reduced-motion: reduce` and confirm the static fallback.
4. Record a Chrome DevTools Performance trace while scrolling the Home page. Target 60fps with no long tasks over 50ms caused by animation code.
5. Run the **`review-animations`** skill as a final audit against every changed file, and fix what it flags.
6. Report back with:
   - Files changed.
   - What each section does now.
   - Anything you skipped and why.
   - Before/after notes on performance.

Work section by section. Commit after each section passes verification, using the message format `feat(motion): <section>`.
