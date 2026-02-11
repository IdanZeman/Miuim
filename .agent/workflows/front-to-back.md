---
description: Project Migration Master Plan: From Client-Side Monolith to Scalable SaaS Architecture
---

> [!IMPORTANT]
> **Project Context:** Before starting this workflow, review [src/README.md](file:///c:/Users/Idanze/.gemini/antigravity/scratch/Miuim/src/README.md) for a comprehensive overview of the system architecture, core modules, and data flow.


The Master Prompt for AI
Project Migration Master Plan: From Client-Side Monolith to Scalable SaaS Architecture

1. Project Context & Objective
We are currently developing "Manage," a SaaS application for workforce and task management (aimed at military and civilian sectors).

Current State: The app is a client-heavy React application where navigation is handled by conditional rendering (state-based) and database logic is embedded directly within UI components.

Desired State: We need to refactor the application into a scalable, secure, and maintainable architecture. This involves implementing client-side routing, separating data access logic into a Service Layer, securing data with Row Level Security (RLS), and moving complex business logic to Server-side Edge Functions.

2. Tech Stack

Frontend: React (Vite), TypeScript, Tailwind CSS.

Backend/BaaS: Supabase (PostgreSQL, Auth, Edge Functions, Storage).

State Management: React Context / Local State (moving towards React Query is optional but recommended).

Routing: React Router DOM (latest version).

3. Migration Roadmap (Phased Approach)
We will execute this migration in 4 distinct phases. Please follow the instructions for each phase strictly.

Phase 1: Architecture & Navigation (The Foundation)
Goal: Replace state-based view switching with a professional routing system.

Action Items:

Install & Setup: Install react-router-dom. Wrap the application in BrowserRouter.

Layout Implementation: Create a MainLayout.tsx component.

This component must hold the persistent Sidebar and Header.

Use <Outlet /> to render the dynamic page content.

Route Definition: Define the following routes in App.tsx:

/ -> DashboardPage

/tasks -> TasksListPage

/tasks/:taskId -> TaskDetailsPage (Important: taskId must handle UUIDs).

/employees -> EmployeesListPage

/login -> LoginPage (Public route).

Route Guards: Implement a ProtectedRoute component. It should check supabase.auth.getSession() and redirect unauthenticated users to /login.

UX Enhancement: Ensure the URL updates correctly when navigating, but the page does not do a full refresh.

Phase 2: The Service Layer (Decoupling)
Goal: Remove all direct Supabase calls from UI components to improve maintainability and testing.

Action Items:

Directory Structure: Create src/services/.

Service Files: Create dedicated files: authService.ts, tasksService.ts, employeesService.ts, storageService.ts.

Refactoring Pattern:

Old Code: const { data } = await supabase.from('tasks').select('*') inside a generic useEffect.

New Code: const tasks = await tasksService.getAllTasks(organizationId).

Standardized Response: All service functions must return a consistent structure, e.g., { data, error } or throw a typed error, so the UI can handle loading/error states uniformly.

Type Safety: Ensure all service functions use strict TypeScript interfaces for inputs and outputs (e.g., Task, Employee).

Phase 3: Data Security (Row Level Security)
Goal: Shift security enforcement from the client ("hiding buttons") to the database ("blocking access").

Action Items:

Enable RLS: Activate RLS on all tables in Supabase.

Policy Definition (SQL):

Isolation: Users must only see data belonging to their specific organization_id.

Auth Check: Use auth.uid() to map the requestor to their profile and organization.

Role-Based Access: Create policies where only users with role = 'admin' or role = 'manager' can perform INSERT, UPDATE, or DELETE operations.

Verification: Provide a checklist or SQL script to verify that a user cannot query data from another organization via the API, even if they guess a valid UUID.

Phase 4: Server-Side Logic (Edge Functions)
Goal: Handle sensitive business logic and transactional operations securely.

Action Items:

Scenario: "User Invitation Flow".

Implementation: Create a Supabase Edge Function named invite-user.

Validation: Check if the requester is an Admin via the JWT.

Execution: Use supabaseAdmin (Service Role) to:
a) Create an auth user.
b) Create a profile record.
c) Send an email (via Resend/SendGrid/SMTP).

Frontend Integration: Add adminService.inviteUser(email, role) which calls supabase.functions.invoke(...).

4. Coding Standards for this Mission

TypeScript: Use strict typing (no any).

Naming: Use camelCase for variables/functions, PascalCase for components.

Error Handling: Fail gracefully. If an API call fails, show a toast notification to the user, do not crash the app.

Clean Code: Keep components small. If a component exceeds 200 lines, break it down.