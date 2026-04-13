# Design System: Architectural Precision

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Technical Blueprint."** 

This system moves away from the generic "SaaS-blue" template look, opting instead for a high-end, editorial aesthetic that mirrors the precision of architectural drafting. It celebrates the grid, treats white space as a structural element, and uses a sophisticated palette of botanical greens contrasted with a high-energy coral accent. 

To achieve this, we avoid "floating" elements in favor of a structured, grounded layout. We utilize intentional asymmetry—where content may be weighted to one side of the grid—and technical "Ghost Lines" to guide the user's eye through a sophisticated hierarchy of information.

---

## 2. Colors
Our palette is rooted in the "Engineering Nature" concept: deep, authoritative forest greens paired with airy, minty surfaces.

*   **Primary (`#5f0f00` / `#ff967d`):** Our "Vibrant Coral." This is used sparingly for maximum impact. It is the heat in an otherwise cool, structured environment.
*   **Secondary (`#376757`):** The "Forest Green." Used for core structural elements and secondary actions to provide a grounded, professional feel.
*   **Tertiary (`#00352d`):** A deep, near-black green used for high-contrast text and architectural accents.
*   **Neutral Surfaces:** A range from `surface-container-lowest` (`#ffffff`) to `surface-dim` (`#d7dbd9`), providing a sophisticated "Paper" feel.

### The "No-Line" Rule
Designers are prohibited from using 1px solid borders to define sections. Layout boundaries must be defined solely through background color shifts. For example, a `surface-container-low` section should sit directly against a `background` section. The change in tone is the boundary.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. 
*   **Level 0:** `background` (#f7faf8) – The foundation.
*   **Level 1:** `surface-container` (#ebefed) – Primary content blocks.
*   **Level 2:** `surface-container-highest` (#e0e3e1) – Prominent cards or focused modules.

### Signature Textures
Use a subtle linear gradient on primary CTAs (from `primary` to `primary_container`) to add a "machined" metallic sheen, avoiding a flat, plastic look.

---

## 3. Typography
The system uses a dual-font approach to balance human readability with technical precision.

*   **Display & Headlines (Manrope):** The modern workhorse. Use `display-lg` and `headline-lg` with tight letter-spacing (-0.02em) to create an authoritative, editorial impact.
*   **Body (Manrope):** High legibility. Maintain a generous line-height (1.6x) for `body-lg` to ensure the "Architectural" feel remains airy and uncrowded.
*   **Labels (Space Grotesk):** To lean into the "Technical Blueprint" aesthetic, all `label-md` and `label-sm` elements (tags, small captions, data points) use Space Grotesk. This monospaced-leaning font signals "data" and "precision."

---

## 4. Elevation & Depth
We eschew traditional drop shadows for **Tonal Layering**.

*   **The Layering Principle:** Depth is achieved by "stacking." Place a `surface-container-lowest` card on a `surface-container-low` section. This creates a soft, natural lift that feels like stacked sheets of architectural vellum.
*   **Ambient Shadows:** If a floating element (like a Modal) is required, use a shadow with a 40px blur and 4% opacity. The shadow color must be a tinted version of `on-surface` (a deep green-grey) rather than pure black.
*   **The "Ghost Border" Fallback:** For interactive inputs, use the `outline-variant` at 20% opacity. This creates a "Ghost Border"—visible enough to define a field, but subtle enough to remain part of the background.
*   **Glassmorphism:** For navigation bars or floating tooltips, use `surface-container-lowest` at 80% opacity with a `20px` backdrop blur. This integrates the component into the environment.

---

## 5. Components

### Buttons
*   **Primary:** Vibrant Coral (`primary`). Corner radius: `sm` (0.125rem) for a sharp, precision-cut look. No shadows. 
*   **Secondary:** Ghost style. Transparent background with a `secondary` 1px ghost border (20% opacity).

### Cards
*   **Style:** No borders. Use `surface-container-low`. 
*   **Grid Integration:** Cards should often align to a visible 12-column technical grid. Use vertical white space (32px or 48px) instead of dividers to separate content.

### Inputs
*   **Field:** `surface-container-lowest`. Corner radius: `none`.
*   **Indicator:** A 2px bottom bar in `primary` (Coral) appears only on focus, mimicking a drafting pencil mark.

### Chips/Tags
*   **Style:** Rectangular with `sm` corners. Use `secondary-container` backgrounds with `on-secondary-container` text in Space Grotesk.

### Technical Grid Lines
*   **Component:** Incorporate a decorative background component consisting of ultra-thin (0.5px) lines using `outline-variant` at 10% opacity. These lines should intersect at key layout points to reinforce the "Architectural" theme.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical layouts where text is balanced by large areas of `surface` color.
*   **Do** use Space Grotesk for any numerical data or technical labels.
*   **Do** lean into sharp corners (`none` or `sm`).
*   **Do** use "Ghost Lines" to connect disparate elements of a layout, mimicking a circuit board or blueprint.

### Don't
*   **Don't** use `full` (pill-shaped) rounded corners. It breaks the engineering aesthetic.
*   **Don't** use standard 1px solid borders for sections.
*   **Don't** use generic grey shadows. Use tonal, ambient blurs.
*   **Don't** crowd the layout. If a section feels full, add 24px of additional padding to the top and bottom.