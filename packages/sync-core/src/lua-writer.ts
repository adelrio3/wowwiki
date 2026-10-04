/**
 * Writes the small Lua files the add-on reads at client start (link and ack).
 * Only string keys, strings, numbers, and booleans are emitted.
 */
export type LuaScalar = string | number | boolean;
export type LuaObject = { [key: string]: LuaScalar | LuaObject };

export function luaString(s: string): string {
  const escaped = s.replace(/[\\"\n\r\t\0-\x1f\x7f]/g, (c) => {
    switch (c) {
      case "\\": return "\\\\";
      case '"': return '\\"';
      case "\n": return "\\n";
      case "\r": return "\\r";
      case "\t": return "\\t";
      default: return "\\" + c.charCodeAt(0).toString().padStart(3, "0");
    }
  });
  return `"${escaped}"`;
}

function luaValue(v: LuaScalar | LuaObject, indent: string): string {
  if (typeof v === "string") return luaString(v);
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("non-finite number");
    return String(v);
  }
  if (typeof v === "boolean") return v ? "true" : "false";
  return luaTable(v, indent);
}

export function luaTable(obj: LuaObject, indent = ""): string {
  const inner = indent + "  ";
  const keys = Object.keys(obj).sort();
  if (keys.length === 0) return "{}";
  const lines = keys.map((k) => `${inner}[${luaString(k)}] = ${luaValue(obj[k]!, inner)},`);
  return `{\n${lines.join("\n")}\n${indent}}`;
}

/** Assignment of a global table, as a complete Lua file. */
export function luaGlobalFile(globalName: string, obj: LuaObject, comment: string): string {
  const header = comment
    .split("\n")
    .map((l) => `-- ${l}`)
    .join("\n");
  return `${header}\n${globalName} = ${luaTable(obj)}\n`;
}
