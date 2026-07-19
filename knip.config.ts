import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignore: ["src/lib/zeus/**"],
  ignoreDependencies: [
    "@neondatabase/serverless",
    "@prisma/client",
    "@serwist/next",
    "@serwist/turbopack",
    "shallow-clone",
    "graphql-zeus",
    "serwist",
  ],
};

export default config;
