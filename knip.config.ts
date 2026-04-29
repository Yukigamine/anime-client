import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignore: ["src/lib/zeus/**"],
  ignoreDependencies: [
    "@neondatabase/serverless",
    "@prisma/client",
    "shallow-clone",
    "graphql-zeus",
  ],
};

export default config;
