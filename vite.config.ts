import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// @ts-expect-error plain JS helper shared with the CLI script
import { fetchScheduleHtml, parseScheduleHtml } from "./scripts/schedule-lib.mjs";

/** Dev/preview endpoint that fetches the live offerings list (the site blocks cross-origin browser requests). */
function liveSchedule(): Plugin {
  const handler = async (_req: unknown, res: import("node:http").ServerResponse) => {
    try {
      const schedule = parseScheduleHtml(await fetchScheduleHtml());
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(schedule));
    } catch (e) {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: String(e) }));
    }
  };
  return {
    name: "live-schedule",
    configureServer(server) {
      server.middlewares.use("/api/schedule", handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/schedule", handler);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), liveSchedule()],
});
