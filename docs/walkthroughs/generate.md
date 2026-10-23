# Generate a commit message

ARACommit describes the staged Git snapshot. Stage only the changes you want included; unstaged and untracked files are ignored and are never added automatically.

1. Review the staged changes in Source Control.
2. Focus the Source Control view and press `Ctrl+G` (`⌘+G` on macOS), click the extension's SCM action, or run **ARACommit: Generate Commit Message** from the Command Palette.
3. Review and edit the generated message before committing.

Choose **Conventional** or **Gitmoji Conventional**, then select one of the bundled languages or `custom` in the sidebar's **Commit message** section. See [commit formats](../commit-formats.md) and [custom languages](../custom-language.md).

**Auto-commit** and **Auto-push** are off by default. Enable them only if you want ARACommit to commit or push after generation; Auto-push requires Auto-commit. See [configuration](../configuration.md).

Cloud providers and remote endpoints receive the staged diff and may charge for requests. Use harmless, non-sensitive changes when testing.
