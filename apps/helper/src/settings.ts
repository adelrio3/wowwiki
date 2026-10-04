/** Helper settings, kept as one JSON file in the app's data folder. */
import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

export interface Settings {
  siteUrl: string;
  deviceToken: string | null;
  wowFolder: string | null;
  paused: boolean;
  deviceName: string;
}

const FILE = "settings.json";
export const DEFAULTS: Settings = { siteUrl: "https://wow-wiki.netlify.app", deviceToken: null, wowFolder: null, paused: false, deviceName: "" };

export async function loadSettings(): Promise<Settings> {
  try {
    if (!(await exists(FILE, { baseDir: BaseDirectory.AppData }))) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(await readTextFile(FILE, { baseDir: BaseDirectory.AppData })) as Partial<Settings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  if (!(await exists("", { baseDir: BaseDirectory.AppData }))) await mkdir("", { baseDir: BaseDirectory.AppData, recursive: true });
  await writeTextFile(FILE, JSON.stringify(s, null, 2), { baseDir: BaseDirectory.AppData });
}
