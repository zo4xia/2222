# Script Agent Draft

`scriptAgentDraft` is the formatting gate between unpredictable Agent output and formal project assets.

- It normalizes candidate `spokenScript` and `boardPlan` before they enter `TeachingProject.assets`.
- It repairs common LaTeX escape damage such as `rac{1}{2}` back to `\frac{1}{2}`.
- It normalizes `<strong>` / escaped tags back to the current `<b>` board marker contract.
- It does not invent segmentation JSON. The only A-track split truth remains `<br>` in `spokenScript`.
