/**
 * Makes the `@testing-library/jest-dom` matcher augmentations
 * (`toBeInTheDocument`, `toBeDisabled`, `toHaveTextContent`, …) visible to the
 * TypeScript compiler for the component tests. The runtime registration lives
 * in `tests/setup.ts`; this side-effect import pulls in the type augmentation
 * of Vitest's `Assertion` interface so `tsc -b` type-checks the tests.
 */
import "@testing-library/jest-dom/vitest";
