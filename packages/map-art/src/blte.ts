import { inflateSync } from "node:zlib";

/** Decode a BLTE container into the plain file bytes. */
export function blteDecode(buf: Buffer): Buffer {
  if (buf.toString("ascii", 0, 4) !== "BLTE") throw new Error("not BLTE");
  const headerSize = buf.readUInt32BE(4);
  const chunks: Array<{ csize: number; dsize: number }> = [];
  let pos = 8;
  if (headerSize === 0) {
    chunks.push({ csize: buf.length - 8, dsize: 0 });
  } else {
    const flags = buf.readUInt8(8);
    const count = (buf.readUInt8(9) << 16) | (buf.readUInt8(10) << 8) | buf.readUInt8(11);
    if (flags !== 0x0f && flags !== 0x10) throw new Error(`unexpected BLTE flags ${flags}`);
    pos = 12;
    for (let i = 0; i < count; i++) {
      chunks.push({ csize: buf.readUInt32BE(pos), dsize: buf.readUInt32BE(pos + 4) });
      pos += 24; // csize, dsize, 16-byte checksum
    }
    pos = headerSize;
  }
  const parts: Buffer[] = [];
  for (const c of chunks) {
    const mode = String.fromCharCode(buf[pos]!);
    const body = buf.subarray(pos + 1, pos + c.csize);
    if (mode === "N") parts.push(Buffer.from(body));
    else if (mode === "Z") parts.push(inflateSync(body));
    else if (mode === "E") throw new Error("encrypted chunk (needs TACT key)");
    else throw new Error(`unknown BLTE chunk mode ${mode}`);
    pos += c.csize;
  }
  return Buffer.concat(parts);
}

