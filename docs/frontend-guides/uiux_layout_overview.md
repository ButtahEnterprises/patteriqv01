# UI/UX Layout Overview for Dashboard

## Dashboard Structure
- Responsive grid layout with 1 column on mobile, 2-3 columns on desktop.
- Three main visual bands:
  1. **Summary Metrics Cards** (Total Sales, Units, Active SKUs & Stores)
  2. **Leaderboards** (Top products by volume/revenue; top stores & declining stores)
  3. **Promotion Calendar and Data Health Panels**

## Visual Hierarchy
- Use larger font sizes and bolder weights for key numeric metrics.
- Use color-coded badges/icons to highlight important values (top performers, warnings).
- Place sparklines or mini-charts next to numeric values for trend context.

## Interaction
- Hover and focus states for table rows and buttons.
- Keyboard navigation through lists and interactive panels.
- Tooltip support for metrics and badge explanation.

## Loading & Error States
- Use consistent skeleton placeholders with animate-pulse.
- Display friendly messages for empty or error states.
- Use aria-live regions to announce content updates.

## Accessibility
- Ensure all interactive elements are reachable by keyboard.
- Use semantic HTML and ARIA roles where needed.
- Include screen reader-only text for detailed descriptions.

## Color & Theme
- Adhere to a dark theme with consistent color usage.
- Use contrast to distinguish important vs. secondary info.

---

