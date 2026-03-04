---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with exceptional design quality. Build web components, pages, dashboards, landing pages, and full applications with bold aesthetics that avoid generic AI-generated looks. Covers design systems, animations, responsive layouts, accessibility, and creative direction. Use when building any web UI.
---

# Frontend Design

## Design Thinking Process

Before writing ANY code, commit to a bold aesthetic direction:

1. **Purpose** — What problem does this interface solve? Who uses it?
2. **Tone** — Pick a distinct aesthetic: brutalist, retro-futuristic, luxury, editorial, organic, maximalist, neo-brutalist, art-deco, pastel, industrial
3. **Differentiation** — What makes this UNFORGETTABLE?
4. **Constraints** — Framework, performance budget, accessibility requirements

**CRITICAL**: Choose a clear conceptual direction and execute with precision. No generic designs.

## Design System Creation

### CSS Custom Properties Foundation
```css
:root {
  /* Typography scale (modular scale ratio 1.25) */
  --font-display: 'Cabinet Grotesk', sans-serif;
  --font-body: 'Satoshi', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --text-xs: clamp(0.64rem, 0.59rem + 0.29vw, 0.8rem);
  --text-sm: clamp(0.8rem, 0.73rem + 0.36vw, 1rem);
  --text-base: clamp(1rem, 0.91rem + 0.45vw, 1.25rem);
  --text-lg: clamp(1.25rem, 1.14rem + 0.57vw, 1.56rem);
  --text-xl: clamp(1.56rem, 1.42rem + 0.71vw, 1.95rem);
  --text-2xl: clamp(1.95rem, 1.78rem + 0.89vw, 2.44rem);
  --text-3xl: clamp(2.44rem, 2.22rem + 1.11vw, 3.05rem);

  /* Spacing scale */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-24: 6rem;

  /* Radius */
  --radius-sm: 0.375rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;
  --radius-full: 9999px;

  /* Transitions */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
}
```

### Color System (HSL-based for flexibility)
```css
:root {
  --hue-primary: 262;
  --primary: hsl(var(--hue-primary) 83% 58%);
  --primary-light: hsl(var(--hue-primary) 83% 72%);
  --primary-dark: hsl(var(--hue-primary) 83% 44%);
  --primary-ghost: hsl(var(--hue-primary) 83% 58% / 0.08);

  --surface-0: hsl(240 10% 3.9%);     /* Deepest background */
  --surface-1: hsl(240 10% 5.9%);     /* Cards */
  --surface-2: hsl(240 10% 9%);       /* Elevated cards */
  --surface-3: hsl(240 10% 13%);      /* Hover states */
  --text-primary: hsl(0 0% 98%);
  --text-secondary: hsl(240 5% 65%);
  --text-tertiary: hsl(240 5% 45%);
  --border: hsl(240 4% 16%);
  --border-subtle: hsl(240 4% 12%);
}
```

## Component Architecture

### Composition over inheritance
```tsx
function Card({ children, variant = "default", interactive = false, className, ...props }) {
  return (
    <div
      className={cn(
        "rounded-xl border transition-all duration-300",
        variant === "default" && "bg-surface-1 border-border",
        variant === "ghost" && "bg-transparent border-transparent",
        variant === "elevated" && "bg-surface-2 border-border shadow-lg",
        interactive && "cursor-pointer hover:border-primary/50 hover:shadow-primary/5 hover:shadow-lg",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
```

## Animation Patterns

### Staggered reveal on scroll (CSS-only)
```css
.reveal-item {
  opacity: 0;
  transform: translateY(20px);
  animation: revealUp 0.6s var(--ease-out) forwards;
}
.reveal-item:nth-child(1) { animation-delay: 0ms; }
.reveal-item:nth-child(2) { animation-delay: 80ms; }
.reveal-item:nth-child(3) { animation-delay: 160ms; }
.reveal-item:nth-child(4) { animation-delay: 240ms; }

@keyframes revealUp {
  to { opacity: 1; transform: translateY(0); }
}
```

### Hover micro-interactions
```css
.interactive-card {
  transition: transform var(--duration-normal) var(--ease-spring),
              box-shadow var(--duration-normal) var(--ease-out);
}
.interactive-card:hover {
  transform: translateY(-4px) scale(1.01);
  box-shadow: 0 20px 40px -12px rgb(0 0 0 / 0.3);
}
```

### Gradient text effect
```css
.gradient-text {
  background: linear-gradient(135deg, var(--primary-light), var(--primary), #ec4899);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

## Responsive Design Strategy
```css
/* Mobile-first breakpoints */
/* sm: 640px  md: 768px  lg: 1024px  xl: 1280px  2xl: 1536px */

.grid-responsive {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
}
@media (min-width: 768px) {
  .grid-responsive { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .grid-responsive { grid-template-columns: repeat(3, 1fr); }
}
```

## Accessibility Requirements
- All interactive elements have visible focus rings
- Color contrast ratio ≥ 4.5:1 for text, ≥ 3:1 for large text
- All images have descriptive `alt` attributes
- Keyboard navigation works for all interactive elements
- ARIA labels on icon-only buttons
- `prefers-reduced-motion` media query for all animations
- Semantic HTML: `<nav>`, `<main>`, `<article>`, `<section>`

## Anti-Slop Rules
**NEVER** use these generic choices:
- Inter, Roboto, Arial as display fonts (body is OK)
- Purple-on-white color schemes without context
- Generic card grids with no visual hierarchy
- Stock photos without treatment
- Cookie-cutter hero sections (big text + CTA + image)

**ALWAYS** make unexpected, intentional choices that serve the context.