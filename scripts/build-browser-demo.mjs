import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { build } from "esbuild";
import { resolve } from "node:path";
const result = await build({
  entryPoints: ["demo/entry.tsx"],
  bundle: true,
  write: false,
  minify: true,
  platform: "browser",
  format: "iife",
  target: ["es2022"],
  jsx: "automatic",
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED": '"false"',
  },
  alias: {
    "next/navigation": resolve("demo/navigation.tsx"),
    "next/link": resolve("demo/link.tsx"),
    "@/lib/client": resolve("demo/client.ts"),
  },
  plugins: [
    {
      name: "browser-demo-copy",
      setup(build) {
        build.onLoad({ filter: /src\/components\/app\.tsx$/ }, (args) => {
          let contents = readFileSync(args.path, "utf8");
          contents = contents
            .replaceAll(
              "Data tersimpan di database SQLite.",
              "Data tersimpan di browser ini.",
            )
            .replaceAll("Tersimpan di server", "Tersimpan di browser ini")
            .replaceAll(
              "Hanya perubahan yang dikonfirmasi server dianggap tersimpan.",
              "Perubahan demo disimpan di browser ini.",
            )
            .replaceAll("DEMO LOKAL", "DEMO BROWSER")
            .replaceAll(
              "window.location.search",
              "(window.location.hash.split('?')[1]||'')",
            )
            .replaceAll(
              "`${window.location.origin}/invite/${token}`",
              "`${window.location.href.split('#')[0]}#/invite/${token}`",
            )
            .replaceAll(
              "`${window.location.origin}/c/${c.slug}`",
              "`${window.location.href.split('#')[0]}#/c/${c.slug}`",
            );
          contents = contents.replace(
            '{c.status !== "draft" && (',
            '{false && c.status !== "draft" && (',
          );
          return { contents, loader: "tsx" };
        });
      },
    },
  ],
});
const cssFiles = readdirSync(".next/static/chunks").filter((f) =>
  f.endsWith(".css"),
);
if (!cssFiles.length) throw new Error("Run pnpm build first to compile CSS");
const css = cssFiles
  .map((f) => readFileSync(`.next/static/chunks/${f}`, "utf8"))
  .join("\n");
const extra =
  ".browser-demo-banner{display:flex;position:relative;z-index:50;justify-content:center;gap:14px;background:#bce875;color:#203119;padding:12px 20px;font:12px Arial;align-items:center}.browser-demo-banner b{font-size:10px;letter-spacing:1px}.sidebar{top:42px}.browser-demo-banner span{font-size:11px}@media(max-width:760px){.browser-demo-banner{flex-direction:column;gap:5px;padding:12px 10px;text-align:center}.sidebar{top:55px}.browser-demo-banner span{font-size:9px}}";
const js = result.outputFiles[0].text.replaceAll("</script", "<\\/script");
const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fun Mini Soccer — Demo Langsung</title><style>${css}\n${extra}</style></head><body><div id="root"></div><noscript>Aktifkan JavaScript untuk mencoba demo.</noscript><script>${js}</script></body></html>`;
mkdirSync("demo-output", { recursive: true });
writeFileSync("demo-output/Fun-Mini-Soccer-Demo.html", html);
console.log(
  `Browser demo generated: ${Math.round(html.length / 1024)} KB, no network or server required.`,
);
