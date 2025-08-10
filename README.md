This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# Frontend Development Guides

Welcome! This folder contains the key frontend implementation guides for our dashboard project to ensure consistency, accessibility, and high quality.

## Location of Guides

All frontend style and architecture guidelines are located in:

- `docs/frontend-guides/`


### Available Guides

- **React Component Guidelines** (`react_component_guidelines.md`)  
  Best practices and conventions for building React components.

- **Tailwind CSS Styling Guidelines** (`tailwind_styling_guidelines.md`)  
  Our styling standards, color palettes, spacing, typography, and animations using Tailwind CSS.

- **UI/UX Layout Overview** (`uiux_layout_overview.md`)  
  Dashboard visual layout, interaction patterns, accessibility notes, and responsiveness.

### How to Use

- Refer to these guides when building or updating components for dashboard features.
- Follow accessibility and responsive design recommendations carefully.
- Use the naming conventions and styling patterns outlined.
- Work closely with design and product teams to maintain visual consistency and clarity.

### Starter Code

Starter React components and Tailwind examples are located in:

- `src/components/`

with names such as `DataHealthCard.tsx` and `TopProductsList.tsx`.

Additional UI primitives and examples:

- Reusable UI components live in `src/components/ui/` (Button, Card, Input, Select, Textarea, Badge, Table, Tabs, Modal)
- An examples gallery is available at `/examples` when running the dev server (e.g., http://localhost:3007/examples)

### Developer Onboarding

New developers should review these guides and run the app locally to become familiar with our architecture and style.

---

If you have questions or need updates to these guides, please contact the project lead.

