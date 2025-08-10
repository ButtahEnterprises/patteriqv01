# React Component Guidelines

## Overview
This guide covers best practices, naming conventions, and patterns for creating React components in our project.

## Component Structure
- Use functional components with hooks.
- Keep components small and focused (single responsibility).
- Group related components in `src/components/`.
- Use descriptive, PascalCase names (e.g., `DataHealthCard.tsx`).

## Props & State
- Prefer props for data passing and state lifting.
- Use local state via `useState` or `useReducer` for UI state.
- Leverage context sparingly for global toggles like Demo/Live mode.

## Data Fetching
- Use centralized data fetching hooks where applicable.
- Pass cookie headers (`piq_demo_mode`) for Demo/Live mode from parent or page level.
- Handle loading, error, and empty states gracefully with skeletons, fallback UI.

## Styling
- Use Tailwind classes directly in JSX for layout, spacing, typography.
- Avoid inline styles unless necessary.
- Follow color and font conventions described in the Tailwind guide.

## Accessibility
- Use semantic HTML elements (`<table>`, `<button>`, `<section>`, etc.).
- Add ARIA labels where needed (especially on charts and interactive elements).
- Provide keyboard navigability: tabbable rows, focus-visible states.
- Use `aria-busy` and `aria-live` for dynamic content updates.

## Testing
- Write unit tests with React Testing Library.
- Test loading, empty, and populated data states.
- Use data-testid attributes for stable selectors in E2E tests.

---

