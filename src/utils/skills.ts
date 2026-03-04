import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

function toForwardSlash(p: string): string {
  return p.replace(/\\/g, "/");
}

export function getSkillsDir(): string {
  return toForwardSlash(path.join(PROJECT_ROOT, "skills"));
}

export function getSkillPaths(skillNames: string[]): string[] {
  const base = getSkillsDir();
  return skillNames.map((name) => `${base}/${name}/`);
}

export function getAllSkillPaths(): string[] {
  const skillsDir = path.join(PROJECT_ROOT, "skills");
  if (!fs.existsSync(skillsDir)) return [];

  return fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => fs.existsSync(path.join(skillsDir, entry.name, "SKILL.md")))
    .map((entry) => `${toForwardSlash(skillsDir)}/${entry.name}/`);
}
