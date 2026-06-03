/**
 * Vitest global setup for the Web_App (`frontend`).
 *
 * Registers the `@testing-library/jest-dom` matchers (e.g. `toBeInTheDocument`,
 * `toHaveTextContent`) for the Testing-Library component tests. This runs for
 * every test file; the jest-dom matchers are inert for the plain (node) unit
 * tests that never touch the DOM.
 */
import "@testing-library/jest-dom/vitest";
