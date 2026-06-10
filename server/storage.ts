import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

// A storage abstraction over the local disk. Files live under data/images and
// are served only through authenticated Express routes, never a public static
// directory. The interface is shaped so an S3 backend can replace it later
// without touching callers.
export interface StoredFile {
  storagePath: string; // relative key, for example "studies/12/abc.png"
  byteSize: number;
  checksum: string;
}

const ROOT = path.resolve(import.meta.dirname, "..", "data", "images");

export const storage = {
  async put(key: string, data: Buffer): Promise<StoredFile> {
    const full = path.join(ROOT, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return {
      storagePath: key,
      byteSize: data.byteLength,
      checksum: crypto.createHash("sha256").update(data).digest("hex"),
    };
  },

  async get(key: string): Promise<Buffer> {
    return fs.readFile(path.join(ROOT, key));
  },

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(path.join(ROOT, key));
      return true;
    } catch {
      return false;
    }
  },

  resolve(key: string): string {
    return path.join(ROOT, key);
  },
};
