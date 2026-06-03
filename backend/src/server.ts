import { createApp } from "./app.js";

/**
 * API_Service entry point.
 *
 * Boots the configured Express application (storage/queue backends selected
 * from configuration at startup, Req 13.4) and listens on `PORT` (default
 * 3000). Kept separate from the {@link createApp} factory so tests can mount
 * the app without binding a port.
 */
const PORT = Number(process.env.PORT ?? 3000);

const app = createApp();
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API_Service listening on http://localhost:${PORT}`);
});
