import type { AssetCdnSource } from "../core/types";

export const DEFAULT_ARK_MODELS_CDN_ID = "osyb";

export const ARK_MODELS_CDN_SOURCES: AssetCdnSource[] = [
  {
    id: "osyb",
    label: "cdn.osyb.cn",
    baseUrl: "https://cdn.osyb.cn/gh/isHarryh/Ark-Models@main",
    description: "Default model asset CDN for Ark-Waifu.",
    recommended: true
  },
  {
    id: "jsdelivr",
    label: "jsDelivr GitHub CDN",
    baseUrl: "https://cdn.jsdelivr.net/gh/isHarryh/Ark-Models@main",
    description: "Public GitHub CDN. Use this as a fallback for static GitHub assets."
  },
  {
    id: "jsdelivr-fastly",
    label: "jsDelivr Fastly endpoint",
    baseUrl: "https://fastly.jsdelivr.net/gh/isHarryh/Ark-Models@main",
    description: "Alternate jsDelivr endpoint. Useful when the default endpoint is slow."
  },
  {
    id: "jsdelivr-gcore",
    label: "jsDelivr Gcore endpoint",
    baseUrl: "https://gcore.jsdelivr.net/gh/isHarryh/Ark-Models@main",
    description: "Alternate jsDelivr endpoint. Availability depends on local network."
  },
  {
    id: "ghproxy-harryh",
    label: "ghproxy.harryh.cn",
    baseUrl: "https://ghproxy.harryh.cn/https://raw.githubusercontent.com/isHarryh/Ark-Models/main",
    description: "Proxy source linked from the Ark-Models README for downloads."
  },
  {
    id: "ghproxy-com",
    label: "ghproxy.com",
    baseUrl: "https://ghproxy.com/https://raw.githubusercontent.com/isHarryh/Ark-Models/main",
    description: "Public GitHub raw proxy. Not guaranteed stable."
  },
  {
    id: "ghproxy-net",
    label: "ghproxy.net",
    baseUrl: "https://ghproxy.net/https://raw.githubusercontent.com/isHarryh/Ark-Models/main",
    description: "Public GitHub raw proxy. Not guaranteed stable."
  },
  {
    id: "gh-llkk",
    label: "gh.llkk.cc",
    baseUrl: "https://gh.llkk.cc/https://raw.githubusercontent.com/isHarryh/Ark-Models/main",
    description: "Public GitHub raw proxy. Not guaranteed stable."
  },
  {
    id: "raw-github",
    label: "GitHub raw",
    baseUrl: "https://raw.githubusercontent.com/isHarryh/Ark-Models/main",
    description: "Official raw GitHub endpoint. Often blocked or slow in mainland China."
  },
  {
    id: "local",
    label: "Local /Ark-Models",
    baseUrl: "/Ark-Models",
    description: "Local Vite/static-server path for development."
  }
];

export function getArkModelsCdnSource(sourceId: string): AssetCdnSource | undefined {
  return ARK_MODELS_CDN_SOURCES.find((source) => source.id === sourceId);
}

export function getDefaultArkModelsCdnSource(): AssetCdnSource {
  return (
    getArkModelsCdnSource(DEFAULT_ARK_MODELS_CDN_ID) ??
    ARK_MODELS_CDN_SOURCES[0]
  );
}
