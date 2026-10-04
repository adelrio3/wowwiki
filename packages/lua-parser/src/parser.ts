/**
 * Parser for the subset of Lua that Blizzard's SavedVariables writer emits.
 *
 * Accepted grammar (and nothing else):
 *
 *   document := (NAME '=' value)*
 *   value    := table | string | number | 'true' | 'false' | 'nil'
 *   table    := '{' (entry (','|';')?)* '}'
 *   entry    := '[' (string|number) ']' '=' value | NAME '=' value | value
 *
 * Line comments starting with `--` are skipped. Function calls, operators,
 * block comments, long strings, and any other construct are rejected, so a
 * tampered file cannot smuggle code or trick the parser.
 *
 * Conversion to JSON:
 * - A table whose keys are exactly the integers 1..n (n >= 1) becomes an array.
 * - Any other table becomes an object with string keys (numbers stringified).
 * - An empty table becomes an empty object; consumers that expect an array
 *   must accept `{}` (see packages/schema luaArray()).
 * - `nil` entries are dropped.
 */

export type LuaValue = string | number | boolean | null | LuaTable | LuaValue[];
export type LuaTable = { [key: string]: LuaValue };

export class LuaParseError extends Error {
  constructor(message: string, public readonly line: number, public readonly column: number) {
    super(`${message} at line ${line}, column ${column}`);
    this.name = "LuaParseError";
  }
}

const MAX_DEPTH = 64;

class Parser {
  private pos = 0;
  private line = 1;
  private lineStart = 0;
  constructor(private readonly src: string) {}

  fail(message: string): never {
    throw new LuaParseError(message, this.line, this.pos - this.lineStart + 1);
  }

  private peek(offset = 0): string {
    return this.src[this.pos + offset] ?? "";
  }

  private advance(n = 1): void {
    for (let i = 0; i < n; i++) {
      if (this.src[this.pos] === "\n") {
        this.line++;
        this.lineStart = this.pos + 1;
      }
      this.pos++;
    }
  }

  private skipSpace(): void {
    for (;;) {
      const c = this.peek();
      if (c === " " || c === "\t" || c === "\r" || c === "\n") {
        this.advance();
      } else if (c === "-" && this.peek(1) === "-") {
        if (this.peek(2) === "[" && this.peek(3) === "[") this.fail("block comments are not allowed");
        while (this.pos < this.src.length && this.peek() !== "\n") this.advance();
      } else {
        return;
      }
    }
  }

  private isNameStart(c: string): boolean {
    return /[A-Za-z_]/.test(c);
  }

  private readName(): string {
    const start = this.pos;
    if (!this.isNameStart(this.peek())) this.fail("expected a name");
    while (/[A-Za-z0-9_]/.test(this.peek())) this.advance();
    return this.src.slice(start, this.pos);
  }

  private expect(ch: string): void {
    if (this.peek() !== ch) this.fail(`expected '${ch}'`);
    this.advance();
  }

  parseDocument(): LuaTable {
    const out: LuaTable = {};
    this.skipSpace();
    while (this.pos < this.src.length) {
      const name = this.readName();
      this.skipSpace();
      this.expect("=");
      this.skipSpace();
      const value = this.parseValue(0);
      if (value !== null) out[name] = value;
      this.skipSpace();
    }
    return out;
  }

  private parseValue(depth: number): LuaValue {
    if (depth > MAX_DEPTH) this.fail("nesting too deep");
    const c = this.peek();
    if (c === "{") return this.parseTable(depth + 1);
    if (c === '"') return this.parseString();
    if (c === "'") this.fail("single-quoted strings are not allowed");
    if (c === "-" || c === "." || (c >= "0" && c <= "9")) return this.parseNumber();
    if (this.isNameStart(c)) {
      const word = this.readName();
      if (word === "true") return true;
      if (word === "false") return false;
      if (word === "nil") return null;
      if (word === "nan" || word === "inf") return null;
      this.fail(`unexpected identifier '${word}'`);
    }
    this.fail("unexpected character");
  }

  private parseNumber(): number {
    const start = this.pos;
    if (this.peek() === "-") this.advance();
    // Blizzard can write "-nan(ind)" or "1.#INF" on some platforms; guard them.
    if (this.src.startsWith("nan", this.pos) || this.src.startsWith("inf", this.pos)) {
      this.advance(3);
      if (this.peek() === "(") {
        while (this.pos < this.src.length && this.peek() !== ")") this.advance();
        this.advance();
      }
      return 0;
    }
    if (this.peek() === "0" && (this.peek(1) === "x" || this.peek(1) === "X")) {
      this.advance(2);
      while (/[0-9A-Fa-f]/.test(this.peek())) this.advance();
      return parseInt(this.src.slice(start, this.pos), 16);
    }
    while (/[0-9]/.test(this.peek())) this.advance();
    if (this.peek() === ".") {
      this.advance();
      while (/[0-9]/.test(this.peek())) this.advance();
    }
    if (this.peek() === "e" || this.peek() === "E") {
      this.advance();
      if (this.peek() === "+" || this.peek() === "-") this.advance();
      while (/[0-9]/.test(this.peek())) this.advance();
    }
    if (this.peek() === "#") {
      // "1.#INF" / "1.#QNAN" from some Windows builds
      while (this.pos < this.src.length && /[#A-Za-z]/.test(this.peek())) this.advance();
      return 0;
    }
    const text = this.src.slice(start, this.pos);
    const n = Number(text);
    if (!Number.isFinite(n)) this.fail(`bad number '${text}'`);
    return n;
  }

  private parseString(): string {
    this.expect('"');
    let out = "";
    for (;;) {
      if (this.pos >= this.src.length) this.fail("unterminated string");
      const c = this.peek();
      if (c === '"') {
        this.advance();
        return out;
      }
      if (c === "\\") {
        const e = this.peek(1);
        this.advance(2);
        switch (e) {
          case "n": out += "\n"; break;
          case "r": out += "\r"; break;
          case "t": out += "\t"; break;
          case "a": out += "\x07"; break;
          case "b": out += "\b"; break;
          case "f": out += "\f"; break;
          case "v": out += "\v"; break;
          case "\\": out += "\\"; break;
          case '"': out += '"'; break;
          case "'": out += "'"; break;
          case "\n": out += "\n"; break;
          default: {
            if (e >= "0" && e <= "9") {
              let digits = e;
              while (digits.length < 3 && /[0-9]/.test(this.peek())) {
                digits += this.peek();
                this.advance();
              }
              const code = Number(digits);
              if (code > 255) this.fail("bad decimal escape");
              out += String.fromCharCode(code);
            } else {
              this.fail(`bad escape '\\${e}'`);
            }
          }
        }
        continue;
      }
      if (c === "\n") this.fail("newline in string");
      out += c;
      this.advance();
    }
  }

  private parseTable(depth: number): LuaTable | LuaValue[] {
    this.expect("{");
    const entries: Array<[string | number, LuaValue]> = [];
    let positional = 1;
    for (;;) {
      this.skipSpace();
      const c = this.peek();
      if (c === "}") {
        this.advance();
        break;
      }
      if (c === "") this.fail("unterminated table");
      let key: string | number;
      if (c === "[") {
        this.advance();
        this.skipSpace();
        const k = this.peek();
        if (k === '"') key = this.parseString();
        else if (k === "-" || (k >= "0" && k <= "9")) key = this.parseNumber();
        else this.fail("table key must be a string or number");
        this.skipSpace();
        this.expect("]");
        this.skipSpace();
        this.expect("=");
        this.skipSpace();
      } else if (this.isNameStart(c) && this.isBareKey()) {
        key = this.readName();
        this.skipSpace();
        this.expect("=");
        this.skipSpace();
      } else {
        key = positional++;
      }
      const value = this.parseValue(depth);
      if (value !== null) entries.push([key, value]);
      this.skipSpace();
      if (this.peek() === "," || this.peek() === ";") this.advance();
      else if (this.peek() !== "}") this.fail("expected ',' or '}'");
    }
    return toJson(entries);
  }

  /** NAME '=' (but not NAME alone, which would be an identifier value like true). */
  private isBareKey(): boolean {
    let i = this.pos;
    while (/[A-Za-z0-9_]/.test(this.src[i] ?? "")) i++;
    while (this.src[i] === " " || this.src[i] === "\t") i++;
    return this.src[i] === "=" && this.src[i + 1] !== "=";
  }
}

function toJson(entries: Array<[string | number, LuaValue]>): LuaTable | LuaValue[] {
  if (entries.length === 0) return {};
  let isArray = true;
  const seen = new Set<number>();
  for (const [k] of entries) {
    if (typeof k !== "number" || !Number.isInteger(k) || k < 1 || k > entries.length || seen.has(k)) {
      isArray = false;
      break;
    }
    seen.add(k);
  }
  if (isArray) {
    const arr: LuaValue[] = new Array(entries.length);
    for (const [k, v] of entries) arr[(k as number) - 1] = v;
    return arr;
  }
  const obj: LuaTable = {};
  for (const [k, v] of entries) obj[String(k)] = v;
  return obj;
}

/**
 * Parse a SavedVariables file's text. Returns an object keyed by the global
 * variable names assigned in the file.
 */
export function parseSavedVariables(text: string): LuaTable {
  // Strip a UTF-8 BOM if present.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return new Parser(src).parseDocument();
}
