import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import hotReloadExtension from "hot-reload-extension-vite";

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        hotReloadExtension({
            log: true,
            backgroundPath: "src/background.ts",
        }),
    ],
    build: {
        outDir: "dist",
        rollupOptions: {
            input: {
                index: "index.html",
                sidepanel: "sidepanel.html",
                background: "src/background.ts",
            },
            output: {
                entryFileNames: (assetInfo) => {
                    // So the service worker file isn't given a randomly generated background
                    // file name like background-[chars].js. This will output into the dist/
                    // directory and manifest.json can properly reference it.
                    if (assetInfo.name === "background") return "background.js";
                    return "[name].js";
                },
            },
        },
    },
    base: "./",
});
