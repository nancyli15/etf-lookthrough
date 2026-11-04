import { defineConfig } from "vitest/config";

// tsconfig's `jsx: preserve` leaves JSX for Next to compile. Tests run without
// Next, so they need JSX compiled here.
export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
});
