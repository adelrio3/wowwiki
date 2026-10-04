import jpeg from "jpeg-js";
import type { Canvas } from "./compose.js";

/** Encode an opaque canvas as JPEG. Maps are parchment: no transparency to keep. */
export function encodeJpeg(c: Canvas, quality = 86): Buffer {
  return Buffer.from(jpeg.encode({ data: c.data, width: c.width, height: c.height }, quality).data);
}
