import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://painscaler.com",
  integrations: [
    starlight({
      title: "PainScaler",
      description:
        "Self-hosted ZPA insight tool. Search, simulate, and audit Zscaler Private Access without opening twelve console tabs.",
      logo: {
        src: "./src/assets/painscaler.svg",
        replacesTitle: true,
      },
      favicon: "/favicon.svg",
      social: {
        github: "https://github.com/PainScaler/painscaler",
      },
      editLink: {
        baseUrl:
          "https://github.com/PainScaler/docs/edit/main/src/content/docs/",
      },
      lastUpdated: true,
      customCss: ["./src/styles/theme.css"],
      components: {
        ThemeSelect: "./src/components/ThemeSelect.astro",
      },
      head: [
        {
          tag: "link",
          attrs: { rel: "preconnect", href: "https://fonts.googleapis.com" },
        },
        {
          tag: "link",
          attrs: {
            rel: "preconnect",
            href: "https://fonts.gstatic.com",
            crossorigin: "",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "stylesheet",
            href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
          },
        },
        {
          tag: "script",
          attrs: { type: "module" },
          content: `
            import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
            mermaid.initialize({
              startOnLoad: true,
              theme: 'dark',
              securityLevel: 'loose',
              themeVariables: {
                background: '#0a0202',
                primaryColor: '#160606',
                primaryBorderColor: '#4a1010',
                primaryTextColor: '#f5d6d6',
                lineColor: '#a52a20',
                secondaryColor: '#110404',
                tertiaryColor: '#160606',
                fontFamily: 'JetBrains Mono, ui-monospace, monospace'
              }
            });
            const obs = new MutationObserver(() => mermaid.run({ querySelector: 'pre.mermaid:not([data-processed])' }));
            obs.observe(document.body, { childList: true, subtree: true });
          `,
        },
      ],
      sidebar: [
        {
          label: "Start here",
          collapsed: false,
          items: [
            { label: "Home", link: "/" },
            { label: "Getting started", slug: "getting-started" },
          ],
        },
        {
          label: "Features",
          collapsed: true,
          items: [
            { label: "Policy simulator", slug: "features/simulator" },
            { label: "Search and reachability", slug: "features/search" },
            { label: "Flow graph and route matrix", slug: "features/graph" },
          ],
        },
        {
          label: "Analytics",
          collapsed: true,
          autogenerate: { directory: "analytics", collapsed: true },
        },
        {
          label: "Deployment",
          collapsed: true,
          autogenerate: { directory: "deployment", collapsed: true },
        },
        {
          label: "Reference",
          collapsed: true,
          autogenerate: { directory: "reference", collapsed: true },
        },
        {
          label: "ZPA notes",
          collapsed: true,
          items: [{ label: "Data model quirks", slug: "data-model" }],
        },
      ],
    }),
  ],
});
