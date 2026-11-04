# Retired: AI editing workspace

Chat, agents, provider/model configuration and automatic shader/media/voice generation are removed. The former workspace verification command was stale and is not an acceptance prerequisite.

Portable edit JSON/presets, creation synchronization, project JSON, sharing and saved shaders remain manual features. See [manual editor workflows](editor-workflows.md).

Current checks are `bun run check:no-ai`, `bun run check:retired-cloud-gpu`, `bun run typecheck`, `bun run test`, `bun run lint` and `bun run build`. See [the removal plan](remove-ai-features.md) for scope and remaining release checks.
