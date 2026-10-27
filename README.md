# file-pager

A Claude Code mod for reading files in a pane beside the conversation.

- **`/view <path>[:<line>[-<line>]]`**: pages a file in the pane with less-style keys and renders Markdown.
- **`show` MCP tool** (`mcp__file-pager__show`): lets Claude pin a document in the pane.
- **`scratch-context` skill** (`skill/scratch-context/SKILL.md`): tells Claude to put long supporting material in a scratchpad document shown in the pane, so the chat reply stays short.

## Install

The repository is private, so the other computer needs GitHub access first: an SSH key, or `gh auth login` followed by `gh auth setup-git`.

At the prompt of a Claude Code session:

```
/plugin install file-pager --marketplace DavidEH/file-pager
```

Or from a shell:

```sh
claude plugin install file-pager --marketplace DavidEH/file-pager
```

Answer `y` to add the marketplace, then pick the user scope.

### Skill

The skill is not installed with the plugin. To add it, clone the repository and link the skill into your user skills:

```sh
git clone git@github.com:DavidEH/file-pager.git ~/Code/mods/file-pager
ln -s ~/Code/mods/file-pager/skill/scratch-context ~/.claude/skills/scratch-context
```

### Developing from a clone

To run the mod from a local folder instead, point Claude Code at it in the `env` block of `~/.claude/settings.json`:

```
"CLAUDE_CODE_PLUGIN_DIRS": "/path/to/file-pager"
```

The skill lives in `skill/`, not `skills/`, so the plugin loader doesn't pick it up a second time as a plugin skill.
