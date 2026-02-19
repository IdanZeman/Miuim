---
description: backend builder - Supabase, RPCs, and Server-side logic
---

# Backend Builder Agent Workflow

Use this workflow for database schema changes, creating or modifying RPCs, and implementing Supabase Edge Functions.

## Goals
- Maintain database integrity and security.
- Optimize query performance.
- Implement robust server-side business logic.

## Steps

1. **Schema & Security Analysis**:
   - Analyze current table structures and RLS policies.
   - Determine if a new table or column is required or if existing ones can be reused.

2. **RPC & Logic Implementation**:
   - Write clean, performance SQL for RPCs.
   - Use Edge Functions for sensitive or complex logic that shouldn't be on the client.
   - Ensure all database interactions go through a secure layer.

3. **Service Layer Integration**:
   - Update `src/services/` to include new backend functionality.
   - Ensure consistent error handling and type safety.

4. **Testing**:
   - Verify changes using Supabase dashboard or local tests.
   - Check RLS policies with different user roles.
