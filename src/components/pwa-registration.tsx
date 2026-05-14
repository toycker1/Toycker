"use client";

import { useEffect } from "react";

type IdleWindow = Window & {
    requestIdleCallback?: (_callback: IdleRequestCallback) => number;
    cancelIdleCallback?: (_handle: number) => void;
};

export default function PWARegistration() {
    useEffect(() => {
        // Prevent registration in development mode to avoid 404 errors
        // (Service worker generation is disabled in development for performance)
        if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") {
            return;
        }

        const idleWindow = window as IdleWindow;
        let idleHandle: number | null = null;
        let delayTimer: number | null = null;

        const registerServiceWorker = () => {
            delayTimer = window.setTimeout(() => {
                navigator.serviceWorker
                    .register("/sw.js")
                    .then((registration) => {
                        console.log("PWA Service Worker registered with scope:", registration.scope);
                    })
                    .catch((error) => {
                        console.error("PWA Service Worker registration failed:", error);
                    });
            }, 1000);
        };

        const handleLoad = () => {
            if (idleWindow.requestIdleCallback) {
                idleHandle = idleWindow.requestIdleCallback(registerServiceWorker);
                return;
            }

            registerServiceWorker();
        };

        if (document.readyState === "complete") {
            handleLoad();
        } else {
            window.addEventListener("load", handleLoad, { once: true });
        }

        return () => {
            window.removeEventListener("load", handleLoad);

            if (idleHandle !== null) {
                idleWindow.cancelIdleCallback?.(idleHandle);
            }

            if (delayTimer !== null) {
                window.clearTimeout(delayTimer);
            }
        };
    }, []);

    return null;
}
