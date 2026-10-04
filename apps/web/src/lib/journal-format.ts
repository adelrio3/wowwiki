/** Class colors as the game uses them, for Journal character cards. */
export const CLASS_COLOR: Record<string, string> = { WARRIOR: "#C69B6D", PALADIN: "#F48CBA", HUNTER: "#AAD372", ROGUE: "#FFF468", PRIEST: "#FFFFFF", SHAMAN: "#0070DD", MAGE: "#3FC7EB", WARLOCK: "#8788EE", DRUID: "#FF7C0A" };

export function realmName(c: { realms?: unknown }): string {
  const r = c.realms;
  if (Array.isArray(r)) return (r[0] as { name?: string } | undefined)?.name ?? "";
  return (r as { name?: string } | null)?.name ?? "";
}

export function played(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null) return "?";
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
