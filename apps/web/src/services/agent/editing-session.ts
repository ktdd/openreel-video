import { CAPABILITY_MANIFEST } from "@openreel/core/capabilities/manifest";
import type { EditingHost } from "@openreel/agent";
import { EditingSession as LocalEditingSession } from "../editing/editing-session";
export { cloneEditSnapshot, projectRevision } from "../editing/editing-session";

/** Temporary adapter for remaining agent callers; manual editing uses the local service. */
export class EditingSession extends LocalEditingSession implements EditingHost {
  capabilities() { return CAPABILITY_MANIFEST; }
  async runJob() { return { ok: false, error: "This job is unavailable in the local workspace" }; }
}
