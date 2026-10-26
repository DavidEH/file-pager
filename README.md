# file-pager

A Claude Code mod for reading files in a pane beside the conversation.

- **`/view <path>[:<line>[-<line>]]`**: pages a file in the pane with less-style keys and renders Markdown.
- **`show` MCP tool** (`mcp__file-pager__show`): lets Claude pin a document in the pane.
- **`scratch-context` skill** (`skill/scratch-context/SKILL.md`): tells Claude to put long supporting material in a scratchpad document shown in the pane, so the chat reply stays short.

## Install

```sh
# Load the mod (add to the env block in ~/.claude/settings.json)
CLAUDE_CODE_PLUGIN_DIRS=/path/to/file-pager

# Install the skill as a user skill
ln -s /path/to/file-pager/skill/scratch-context ~/.claude/skills/scratch-context
```

The skill lives in `skill/`, not `skills/`, so the plugin loader doesn't pick it up a second time as a plugin skill.
