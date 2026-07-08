import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(__dirname);

async function main() {
  try {
    console.log("[postinstall] Preparing Chromium archive for Vercel...");

    const chromiumResolvedPath = import.meta.resolve("@sparticuz/chromium");
    const chromiumPath = chromiumResolvedPath.replace(/^file:\/\//, "");
    const chromiumDir = dirname(dirname(chromiumPath));
    const binDir = join(chromiumDir, "bin");

    if (!existsSync(binDir)) {
      console.log("[postinstall] Chromium bin directory not found; skipping");
      return;
    }

    const publicDir = join(projectRoot, "public");
    const outputPath = join(publicDir, "chromium-pack.tar");

    execSync(
      `mkdir -p "${publicDir}" && tar -cf "${outputPath}" -C "${binDir}" .`,
      {
        stdio: "inherit",
        cwd: projectRoot,
      },
    );

    console.log("[postinstall] Chromium archive created:", outputPath);
  } catch (error) {
    console.error("[postinstall] Failed to create chromium archive:", error);
    console.log("[postinstall] Continuing; local development can still run");
  }
}

main();
