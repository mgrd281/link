---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

<!--
Linkyo change: upstream fetches the guidelines from the internet before every review. This copy
reads a reviewed snapshot instead (guidelines.md, vercel-labs/web-interface-guidelines at 434b7f9,
MIT), so the rules cannot change without review. To update, copy command.md again at a newer
commit, read the diff, and update the commit here and in ../README.md.
-->

## How It Works

1. Read the guidelines in `guidelines.md` next to this file
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in the guidelines
4. Output findings in the terse `file:line` format

## Guidelines Source

`guidelines.md` in this skill's folder (`.claude/skills/web-design-guidelines/guidelines.md`). It
contains all the rules and output format instructions.

In this repository, Linkyo's own rules win where they differ: design tokens only (see the
`linkyo-design-tokens` skill), German/English/Arabic with right-to-left layouts, and no
third-party requests from pages by default.

## Usage

When a user provides a file or pattern argument:
1. Read `guidelines.md`
2. Read the specified files
3. Apply all rules from the guidelines
4. Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.
