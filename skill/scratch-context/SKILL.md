---
name: scratch-context
description: Keep supporting context out of the chat by writing it to a scratchpad Markdown document that the file-pager mod shows in its pane beside the conversation. Use when a reply would otherwise carry long secondary material — background research, option comparisons, long code walkthroughs, design or decision drafts, command output summaries — so the chat reply holds only the conclusion and a pointer. Also use when the user asks to "put it in the scratchpad", "show it in the pane", or "keep the chat clean".
---

# Scratch context

The chat holds the main thread: answers, decisions, next steps. Supporting
material goes into a scratchpad document that the person reads in the
file-pager pane, so the two concerns do not mix.

## How the pane gets opened

The file-pager mod (`~/Code/mods/file-pager`) watches each reply on the main
conversation. After the reply ends, it opens the **first file reference that
carries a line number** in the pager pane, leaving the keyboard with the
prompt. Nothing has to be typed; the reference in the reply is the trigger.

A reference counts only in one of these forms:

- `path/to/file.md:1`
- `path/to/file.md:12-30` (that region is highlighted)
- `path/to/file.md#L12-L30`

A bare path such as `path/to/file.md`, with no line number, opens nothing.

## When to use a scratch document

Use one when the secondary material is longer than a short paragraph or a
small list, for example:

- research findings, sources and notes behind a recommendation
- comparisons of options, libraries or approaches
- step-by-step walkthroughs of code or of a design
- drafts of decisions, plans or documentation the person will review
- summaries of long command output or logs

Do not use one for short answers, or for content that is the answer itself;
those stay in the chat.

## Steps

1. **Pick the folder.** Use `.claude/scratch/` at the root of the session's
   working directory. Create it when missing.
2. **Keep it out of git.** The first time in a project, check whether the
   folder is ignored with `git check-ignore -q .claude/scratch/`. When it is
   not, append `.claude/scratch/` to `.git/info/exclude`. That file is local
   to this clone, so the project's own `.gitignore` stays untouched. Skip
   this step outside a git repository.
3. **Name the document by topic**, in lowercase words joined by hyphens:
   `cli-library-comparison.md`, `config-loading-walkthrough.md`. One topic,
   one file.
4. **Write the document** in Markdown, starting with a `# Title` line and
   one line that says what question it answers. Organize the rest with
   headings so it reads well on its own.
5. **Update instead of duplicating.** When a later turn continues a topic,
   edit the existing document rather than starting a new one. When the
   update concerns one section, reference that section's line range so the
   pane lands on it highlighted.
6. **Write the chat reply** as:
   - the conclusion or answer, in a few sentences;
   - then the scratch document as the **first** line-numbered file
     reference in the whole reply, e.g.
     "Details are in the pane: `.claude/scratch/cli-library-comparison.md:1`".

## Rules for the reply

- **The scratch reference comes first.** Only the first line-numbered
  reference opens automatically. Any reference to source code
  (`src/app.ts:42`) must come after it, or the pane shows that code instead.
  The person can step through the remaining references with `r` and `t` in
  the pane.
- **Do not repeat the document in the chat.** Summarize; the pane holds the
  detail.
- **Mention the document even when nothing else changed**, if the person
  should look at it again: the pane follows the latest reply, so a reply
  that refers to another file replaces the document in the pane.
- **Expect the source view first.** A line-numbered reference opens the
  Markdown as plain source; the person presses `m` in the pane to switch to
  the rendered view. Favor headings, short paragraphs and lists over wide
  tables so both views read well.
