"use client";

import dynamic from "next/dynamic";

const PWARegistration = dynamic(() => import("@/components/pwa-registration"), {
    ssr: false,
});

export default function PWAClientWrapper() {
    return (
        <>
            <PWARegistration />
        </>
    );
}
