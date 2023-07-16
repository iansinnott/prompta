import { error, json, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dev } from "$app/environment";

export const prerender = true;

const manifest = {
  short_name: "Prompta",
  name: "Prompta",
  icons: [
    {
      purpose: "maskable",
      src: "/maskable-icon-512x512.png",
      sizes: "512x512",
      type: "image/png",
    },
    {
      src: "/pwa-512x512.png",
      sizes: "512x512",
      type: "image/png",
    },
    {
      src: "/pwa-192x192.png",
      sizes: "192x192",
      type: "image/png",
    },
    {
      src: "/apple-touch-icon-180x180.png",
      sizes: "180x180",
      type: "image/png",
    },
    {
      src: "/pwa-64x64.png",
      sizes: "64x64",
      type: "image/png",
    },
  ],
  display: "standalone",
  theme_color: "#1B1B1B",
  background_color: "#ffffff",
  start_url: dev ? "/" : "https://chat.prompta.dev",
  scope: "/",
};

export const GET: RequestHandler = async ({ url, setHeaders }) => {
  setHeaders({
    "Content-Type": "application/manifest+json",
  });
  return new Response(JSON.stringify(manifest));
};
