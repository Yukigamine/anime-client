"use client";

import { SWRConfig } from "swr";

export default function SWRProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SWRConfig
      value={{
        onError: (error) => {
          console.error("[SWR]", error);
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
