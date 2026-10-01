// Deletes the offline demo database so it is re-created and re-seeded with
// fresh fictional data on the next request. Stop the server first.
import { rmSync } from "node:fs";
import path from "node:path";

const dir = process.env.DEMO_DATA_DIR || path.join(process.cwd(), ".data");
rmSync(path.join(dir, "demo-db"), { recursive: true, force: true });
console.log("Demo database removed. It will be re-seeded on the next start.");
