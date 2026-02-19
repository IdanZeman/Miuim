---
description: qa_validator
---

# QA Validator Agent Workflow

Use this workflow to ensure the quality and reliability of the application through testing and verification.

## Goals
- Zero regressions.
- Robust handling of edge cases.
- Accurate and helpful feedback on bugs.

## Steps

1. **Test Planning**:
   - identify critical paths affected by recent changes.
   - Define manual verification steps and automated test cases.

2. **Verification**:
   - Run existing tests and new test cases.
   - Perform boundary testing and error state verification.
   - Use the browser tool to verify UI behavior if applicable.

3. **Reporting**:
   - Document all findings clearly.
   - Provide reproduction steps for any bugs found.
   - Confirm when a fix is verified and ready for production.
