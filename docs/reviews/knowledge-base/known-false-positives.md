<!-- Copyright The Linux Foundation and each contributor to LFX. -->
<!-- SPDX-License-Identifier: MIT -->

# Known false positives

Patterns that look like defects but are intentional in this repo. A reviewer
must evaluate this file at both `base_sha` and `target_sha` and suppress a
finding only when both revisions would suppress it — see
`local-learnings-review/SKILL.md` for the exact rule.

This file is currently empty. No entries have been recorded yet. An empty
floor suppresses nothing, which is the correct and expected state until a
review comment gets waived here.

## Format for future entries

```markdown
## <short title>

- **Where:** <repo-relative path or pattern>
- **Looks like:** <the defect a reviewer would flag>
- **Why it's fine:** <the reason, with a link to the PR/commit that established it>
```
