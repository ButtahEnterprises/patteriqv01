# Tailwind CSS Styling Guidelines

## General Principles
- Follow a consistent dark theme palette.
- Use spacing scales (`p-4`, `m-2`, `space-x-4`) for margins and padding.
- Prefer utility classes over custom CSS when possible.
- Use responsive classes (`sm:`, `md:`, `lg:`) to make layouts adaptive.

## Typography
- Headings: Use `text-lg` or larger with font-bold for titles and key numbers.
- Body text: `text-sm`, `text-gray-300` or lighter for secondary info.
- Use `truncate` for long text in tables.

## Colors
- Use brand colors and semantic colors:
  - Green for success or positive trends.
  - Yellow (#fde047 or close) for warnings.
  - Red for negative trends or alerts.
- Ensure color contrast meets WCAG 2.1 AA standards.

## Layout & Spacing
- Use flexbox or grid for layout (`flex`, `grid`, `grid-cols-2`).
- Maintain consistent gutters between panels.
- Add subtle shadows (`shadow-md`) and rounded corners (`rounded-lg`) for card-like look.

## Animations & Transitions
- Use Tailwind's `animate-pulse` for skeletons.
- Use `transition-all`, `duration-300` for smooth fade/slide effects.
- Avoid heavy animations for performance.

## Accessibility
- Use focus-visible rings (`focus:outline-none focus-visible:ring`) on interactive elements.
- Maintain large clickable areas with sufficient padding.

---

