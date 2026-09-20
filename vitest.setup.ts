import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library does not auto-clean up between tests outside of Jest's
// global afterEach hook, which this repo doesn't have (Vitest, not Jest) —
// without this, a component left mounted by one test can be found by a
// getBy* query in the next test and produce a false pass.
afterEach(() => {
  cleanup();
});
