---
description: orchestrator - Prompt analysis, refinement, and routing
---

# Orchestrator Agent Workflow

Use this workflow to start any task. It will help you refine your prompt and suggest the best specialized agent for the job.

## Goals
- Transform vague requests into high-quality, professional prompts.
- Ensure the best tool/agent is used for each specific task.
- Improve accuracy and efficiency of AI interactions.

## Steps

1. **Prompt Analysis**:
   - Analyze the user's raw prompt for intent, context, and requirements.
   - Identify missing information that would help in fulfilling the request.

2. **Prompt Refinement**:
   - rewrite the prompt into a "Professional Prompt".
   - **Template**:
     - **Context**: [Briefly describe the project context and current state]
     - **Objective**: [State the clear goal]
     - **Requirements**: [List specific technical and functional requirements]
     - **Constraints**: [List any limitations or standards to follow]
     - **Suggested Approach**: [Step-by-step plan]

3. **Routing**:
   - Identify which specialized agent(s) are best suited for the refined prompt.
   - Provide a direct link to the recommended workflow(s).

### Recommended Agents:
- Design/Architecture -> [/architect](file:///c:/Users/Idanze/.gemini/antigravity/scratch/Miuim/.agent/workflows/architect.md)
- Database/Server-side -> [/backend-builder](file:///c:/Users/Idanze/.gemini/antigravity/scratch/Miuim/.agent/workflows/backend-builder.md)
- Code Analysis/Bugs -> [/code-review](file:///c:/Users/Idanze/.gemini/antigravity/scratch/Miuim/.agent/workflows/code-review.md)
- Documentation -> [/documentation](file:///c:/Users/Idanze/.gemini/antigravity/scratch/Miuim/.agent/workflows/documentation.md)
- Product Requirements -> [/prd](file:///c:/Users/Idanze/.gemini/antigravity/scratch/Miuim/.agent/workflows/prd.md)
- Testing/QA -> [/qa-validator](file:///c:/Users/Idanze/.gemini/antigravity/scratch/Miuim/.agent/workflows/qa-validator.md)
- UI/UX Excellence -> [/ui-designer](file:///c:/Users/Idanze/.gemini/antigravity/scratch/Miuim/.agent/workflows/ui-designer.md)
