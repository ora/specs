// Compile-time checks on dist/index.d.ts: literal types survive, so consumers can narrow on version ids.
import { reviewedPin, sourceKey, spec, versionIds, type VersionId } from "../../dist/index.js";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assertType = <T extends true>(): T => true as T;

const pap = versionIds("pap", ["current", "supported", "preview"] as const);
assertType<Equal<(typeof pap)[number], "0.4" | "0.3" | "0.2" | "0.1">>();
assertType<Equal<VersionId<"mcp", "current">, "2026-07-28">>();
const current: "2026-07-28" = spec("mcp").current;
const pin: string = reviewedPin("webmcp", "git-path");
const key: string = sourceKey(spec("webmcp").sources[0]);
// @ts-expect-error an id the registry does not have
spec("nope");
export { current, pin, key };
