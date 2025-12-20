# @repo/ui

Shared UI components package using shadcn/ui.

## Setup

This package is configured with shadcn/ui and uses the shared Tailwind configuration from `@repo/tailwind-config`.

## Adding Components

To add shadcn/ui components to this package, use the shadcn CLI:

```bash
cd packages/ui
bunx shadcn@canary add [component-name]
```

For example:

```bash
bunx shadcn@canary add button
bunx shadcn@canary add card
```

Components will be added to `src/components/ui/` and can be imported from `@repo/ui/components/ui/[component-name]`.

## Using Components

Import components in your apps:

```tsx
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
```

## Utilities

The `cn` utility function is available for merging class names:

```tsx
import { cn } from "@repo/ui/lib/utils";
```

## Styles

Import the Tailwind styles in your app's main CSS file:

```css
@import "@repo/tailwind-config/styles";
```

This will include all Tailwind utilities and shadcn/ui theme variables.
