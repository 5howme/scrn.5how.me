// Optional version sync: when a parent checkout provides a version file, adopt
// it as package.json version so build artifacts share one version line.
// No-op in a standalone checkout. Runs at the start of build scripts.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vrsnFile = path.resolve(root, "..", "..", "srvr", "pblc", "aaaa", "vrsn.txt");
const pkgFile = path.join(root, "package.json");

let vrsn;
try {
	vrsn = readFileSync(vrsnFile, "utf-8").trim();
} catch {
	console.log("[sync-vrsn] no parent version file — keeping package.json version");
	process.exit(0);
}

if (!/^\d+\.\d+\.\d+$/.test(vrsn)) {
	console.error(`[sync-vrsn] invalid version "${vrsn}"`);
	process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgFile, "utf-8"));
if (pkg.version !== vrsn) {
	pkg.version = vrsn;
	writeFileSync(pkgFile, `${JSON.stringify(pkg, null, "\t")}\n`);
	console.log(`[sync-vrsn] package.json version -> ${vrsn}`);
} else {
	console.log(`[sync-vrsn] already ${vrsn}`);
}
