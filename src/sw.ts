import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

type SerwistWorkerGlobal = typeof globalThis &
    SerwistGlobalConfig & {
        __SW_MANIFEST: (string | PrecacheEntry)[] | undefined;
    };

declare const self: SerwistWorkerGlobal;

const uncachedMediaMatchers = [
    /\.(?:mp3|wav|ogg)$/i,
    /\.(?:mp4|webm)$/i,
];

const userSpecificRoutePrefixes = [
    "/api/cart",
    "/api/storefront/layout-state",
    "/cart",
    "/checkout",
    "/account",
];

const isUserSpecificPath = (pathname: string) =>
    userSpecificRoutePrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );

const userSpecificRuntimeCaching: RuntimeCaching = {
    matcher: ({ sameOrigin, url }) =>
        sameOrigin && isUserSpecificPath(url.pathname),
    handler: new NetworkOnly(),
};

const runtimeCaching: RuntimeCaching[] = [
    userSpecificRuntimeCaching,
    ...defaultCache.filter(({ matcher }) => {
        const matcherSource = String(matcher);

        return !uncachedMediaMatchers.some((pattern) => pattern.test(matcherSource));
    }),
];

const precacheEntries = (self.__SW_MANIFEST ?? []).filter((entry) => {
    const url = typeof entry === "string" ? entry : entry.url;

    return !uncachedMediaMatchers.some((pattern) => pattern.test(url));
});

const serwist = new Serwist({
    precacheEntries,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching,
});

serwist.addEventListeners();
