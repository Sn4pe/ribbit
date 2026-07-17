import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://ribbit.sn4pe.com",
	integrations: [mdx(), sitemap(), svelte()],
	vite: {
		plugins: [tailwindcss()],
	},
});
