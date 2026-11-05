import { execFileSync } from "node:child_process";
import console from "node:console";
import { existsSync } from "node:fs";
import process from "node:process";

if (!existsSync(".git")) {
  console.log("install-git-hooks: no .git here, skipped");
  process.exit(0);
}

execFileSync("git", ["config", "core.hooksPath", ".githooks"], { stdio: "inherit" });
console.log("install-git-hooks: core.hooksPath=.githooks");
