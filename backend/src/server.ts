import { createApp } from "./app";
import { env } from "./config/env";
import { migrateInlineImages } from "./utils/migrate-images";

const app = createApp();

app.listen(env.port, () => {
  console.log(`AlugaTools API running on port ${env.port}`);
  // Background: move images still saved as base64 in the database to Storage.
  setTimeout(() => {
    migrateInlineImages().catch((err) => console.error("[images] migration aborted:", err));
  }, 5_000);
});
