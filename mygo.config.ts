import { defineConfig } from "mygo-cli";

export default defineConfig({
  name: "BLBL Music Player",
  identifier: "com.opencode.blbl-music-player",
  version: "3.1.0",
  copyright: "© Kibidango086",
  // `mygo dev` runs devCommand and loads devUrl; `mygo build` runs
  // buildCommand and embeds frontendDist into the app.
  devUrl: "http://localhost:5173",
  devCommand: "bun run dev:web",
  buildCommand: "bun run build:web",
  frontendDist: "dist",
  bindings: "src/mygo.ts",
  out: "build",
  icon: "resources/icon.png",
  linux: {
    maintainer: "Kibidango086",
    comment: "把 B 站变成你的音乐库",
    categories: ["AudioVideo", "Audio", "Player"],
  },
});
