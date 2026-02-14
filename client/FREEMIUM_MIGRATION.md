# 🚀 Freemium Migration Guide - Miuim System

> **Production-Ready Implementation Guide**  
> This document provides a complete, step-by-step guide to implement the Freemium model in the Miuim system.  
> **Status**: ✅ Tested and Ready for Main Branch

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1: Database Migration](#phase-1-database-migration)
4. [Phase 2: Frontend Implementation](#phase-2-frontend-implementation)
5. [Phase 3: Integration & Testing](#phase-3-integration--testing)
6. [Phase 4: Deployment](#phase-4-deployment)
7. [Rollback Plan](#rollback-plan)
8. [FAQ & Troubleshooting](#faq--troubleshooting)

---

## 🎯 Overview

### What This Migration Does

This migration transforms Miuim into a **three-tier subscription system**:

| Tier | Max People | Max Teams | Max Roles | Max Missions | Advanced Tools | Battalion Dashboard |
|------|-----------|-----------|-----------|--------------|----------------|---------------------|
| **Lite** | 50 | 4 | 5 | 3 | ❌ | ❌ |
| **Pro** | ∞ | ∞ | ∞ | ∞ | ✅ | ❌ |
| **Battalion** | ∞ | ∞ | ∞ | ∞ | ✅ | ✅ |

**Advanced Tools**: Equipment Manager, Gate Control, Exit Requests  
**Battalion Dashboard**: Cross-company analytics and management

### Architecture Changes

```
┌─────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                        │
│  • organizations.tier column                            │
│  • SQL triggers for quota enforcement                   │
│  • RLS policies (future enhancement)                    │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    LOGIC LAYER                           │
│  • src/constants/limits.ts                              │
│  • src/hooks/useSubscription.ts                         │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    UI LAYER                              │
│  • PremiumFeatureGuard (inline locks)                   │
│  • PremiumPageGuard (full page blocks)                  │
│  • UpgradeModal (conversion funnel)                     │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ Prerequisites

Before starting, ensure you have:

- [ ] **Database Access**: Supabase admin credentials
- [ ] **Git Access**: Ability to create and merge branches
- [ ] **Node.js**: v18+ installed
- [ ] **Backup**: Recent database backup (critical!)
- [ ] **Testing Environment**: Staging/dev environment available

**Estimated Time**: 2-3 hours (including testing)

---

## 📊 Phase 1: Database Migration

### Step 1.1: Backup Current Database

```bash
# Using Supabase CLI
supabase db dump -f backup_pre_freemium_$(date +%Y%m%d).sql

# Or via Supabase Dashboard:
# Settings → Database → Backups → Create Backup
```

### Step 1.2: Run SQL Migration

**File**: `freemium_phase1_foundation.sql`

```sql
-- This migration does 3 things:
-- 1. Adds 'tier' column to organizations table
-- 2. Sets all existing orgs to 'pro' (no disruption)
-- 3. Creates enforcement triggers for Lite tier limits
```

**Execution Options**:

#### Option A: Supabase Dashboard (Recommended)
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `freemium_phase1_foundation.sql`
3. Click "Run"
4. Verify success message

#### Option B: Supabase CLI
```bash
supabase db push --file freemium_phase1_foundation.sql
```

### Step 1.3: Verify Migration

Run this query to confirm:

```sql
-- Check that tier column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'organizations' AND column_name = 'tier';

-- Verify all orgs are 'pro'
SELECT id, name, tier FROM organizations LIMIT 10;

-- Check triggers are created
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name LIKE '%enforce%';
```

**Expected Results**:
- ✅ `tier` column exists with default 'pro'
- ✅ All existing organizations have `tier = 'pro'`
- ✅ 3 triggers created: `trigger_enforce_soldier_limit`, `trigger_enforce_team_limit`, `trigger_enforce_role_limit`

---

## 💻 Phase 2: Frontend Implementation

### Step 2.1: Install Dependencies

**No new dependencies required!** All components use existing libraries.

Verify your `package.json` includes:
- `@tanstack/react-query` (already installed)
- `@phosphor-icons/react` (already installed)
- `framer-motion` (already installed)

### Step 2.2: Add Core Files

Copy the following files from the freemium branch:

#### **2.2.1 Constants**
```bash
# Create directory
mkdir -p src/constants

# Add file: src/constants/limits.ts
```

<details>
<summary>📄 View src/constants/limits.ts</summary>

```typescript
export type SubscriptionTier = 'lite' | 'pro' | 'battalion';

export interface PlanLimits {
    maxPeople: number;
    maxTeams: number;
    maxRoles: number;
    maxMissions: number;
    hasAdvancedTools: boolean;
    hasFullDataExport: boolean;
    hasMonthlyView: boolean;
    hasBattalionDashboard: boolean;
}

export const PLAN_LIMITS: Record<SubscriptionTier, PlanLimits> = {
    lite: {
        maxPeople: 50,
        maxTeams: 4,
        maxRoles: 5,
        maxMissions: 3,
        hasAdvancedTools: false,
        hasFullDataExport: false,
        hasMonthlyView: true,
        hasBattalionDashboard: false,
    },
    pro: {
        maxPeople: Infinity,
        maxTeams: Infinity,
        maxRoles: Infinity,
        maxMissions: Infinity,
        hasAdvancedTools: true,
        hasFullDataExport: true,
        hasMonthlyView: true,
        hasBattalionDashboard: false,
    },
    battalion: {
        maxPeople: Infinity,
        maxTeams: Infinity,
        maxRoles: Infinity,
        maxMissions: Infinity,
        hasAdvancedTools: true,
        hasFullDataExport: true,
        hasMonthlyView: true,
        hasBattalionDashboard: true,
    }
};

export const DEFAULT_TIER: SubscriptionTier = 'lite';

export const getPlanLimits = (tier?: SubscriptionTier | null): PlanLimits => {
    return PLAN_LIMITS[tier || DEFAULT_TIER];
};
```
</details>

#### **2.2.2 Hooks**
```bash
# Add file: src/hooks/useSubscription.ts
```

<details>
<summary>📄 View src/hooks/useSubscription.ts</summary>

```typescript
import { useMemo } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { useOrganizationData } from './useOrganizationData';
import { getPlanLimits, PlanLimits, SubscriptionTier } from '../constants/limits';

export interface QuotaInfo {
    current: number;
    max: number;
    remaining: number;
    percentage: number;
    isExceeded: boolean;
}

export const useSubscription = () => {
    const { organization, user } = useAuth();
    const { 
        people, 
        teams, 
        roles, 
        taskTemplates 
    } = useOrganizationData(organization?.id, {}, user?.id);

    const tier: SubscriptionTier = (organization?.tier as SubscriptionTier) || 'lite';
    
    const limits = useMemo(() => getPlanLimits(tier as SubscriptionTier), [tier]);

    const hasAccessTo = (feature: keyof PlanLimits) => {
        return !!limits[feature];
    };

    const getQuota = (type: 'people' | 'teams' | 'roles' | 'missions'): QuotaInfo => {
        let current = 0;
        let max = Infinity;

        switch (type) {
            case 'people':
                current = people.filter(p => p.isActive !== false).length;
                max = limits.maxPeople;
                break;
            case 'teams':
                current = teams.length;
                max = limits.maxTeams;
                break;
            case 'roles':
                current = roles.length;
                max = limits.maxRoles;
                break;
            case 'missions':
                current = taskTemplates.length;
                max = limits.maxMissions;
                break;
        }

        const remaining = max === Infinity ? Infinity : Math.max(0, max - current);
        const percentage = max === Infinity ? 0 : Math.min(100, (current / max) * 100);
        const isExceeded = current >= max;

        return {
            current,
            max,
            remaining,
            percentage,
            isExceeded
        };
    };

    const canAdd = (type: 'people' | 'teams' | 'roles' | 'missions') => {
        const quota = getQuota(type);
        return !quota.isExceeded;
    };

    return {
        tier,
        limits,
        hasAccessTo,
        getQuota,
        canAdd,
        isLite: tier === 'lite',
        isPro: tier === 'pro',
        isBattalion: tier === 'battalion'
    };
};
```
</details>

#### **2.2.3 Premium Components**
```bash
# Create directory
mkdir -p src/components/Premium

# Add 3 files:
# - src/components/Premium/PremiumFeatureGuard.tsx
# - src/components/Premium/PremiumPageGuard.tsx
# - src/components/Premium/UpgradeModal.tsx
```

**Note**: Full component code is available in the freemium branch. Copy these files as-is.

### Step 2.3: Update Type Definitions

**File**: `src/types.ts`

Add `tier` field to `Organization` interface:

```typescript
export interface Organization {
  id: string;
  name: string;
  created_at: string;
  invite_token?: string;
  is_invite_link_active?: boolean;
  invite_link_role?: UserRole;
  invite_link_template_id?: string;
  battalion_id?: string | null;
  is_hq?: boolean;
  tier: 'lite' | 'pro' | 'battalion'; // ← ADD THIS LINE
}
```

### Step 2.4: Update Components with Guards

#### **Example 1: Navbar** (Feature-level locking)

**File**: `src/components/layout/Navbar.tsx`

```typescript
import { PremiumFeatureGuard } from '../Premium/PremiumFeatureGuard';
import { PlanLimits } from '../../constants/limits';

// In your nav items definition:
const TABS: NavItem[] = [
    {
        id: 'logistics',
        label: 'לוגיסטיקה',
        icon: PackageIcon,
        primaryView: 'equipment',
        views: ['equipment', 'gate'],
        subItems: [
            { 
                label: 'רשימת ציוד', 
                view: 'equipment', 
                icon: PackageIcon, 
                description: 'מעקב אחר נשקים וציוד', 
                feature: 'hasAdvancedTools' // ← MARK AS PREMIUM
            },
            { 
                label: 'ש.ג ורכבים', 
                view: 'gate', 
                icon: CarIcon, 
                description: 'רישום כניסות וניהול רכבים', 
                feature: 'hasAdvancedTools' // ← MARK AS PREMIUM
            }
        ]
    },
];

// In your render:
{tab.subItems.map((item) => {
    const content = (
        <button onClick={() => onNav(item.view)}>
            {item.label}
        </button>
    );

    if (item.feature) {
        return (
            <PremiumFeatureGuard
                key={item.view}
                feature={item.feature as keyof PlanLimits}
                featureName={item.label}
                mode="badge-inline"
                tierRequired="pro"
            >
                {content}
            </PremiumFeatureGuard>
        );
    }

    return <React.Fragment key={item.view}>{content}</React.Fragment>;
})}
```

#### **Example 2: PersonnelManager** (Quota enforcement)

**File**: `src/features/personnel/PersonnelManager.tsx`

```typescript
import { useSubscription } from '../../hooks/useSubscription';

export const PersonnelManager = () => {
    const { canAdd, getQuota } = useSubscription();
    
    const handleAddPerson = () => {
        if (!canAdd('people')) {
            const quota = getQuota('people');
            showToast(
                `הגעת למגבלת ${quota.max} לוחמים במסלול Lite. שדרג ל-Pro להוספת לוחמים נוספים.`,
                'error'
            );
            return;
        }
        
        // Continue with add logic...
    };
    
    return (
        <div>
            <Button onClick={handleAddPerson}>
                הוסף לוחם
            </Button>
        </div>
    );
};
```

#### **Example 3: App.tsx** (Page-level blocking)

**File**: `src/App.tsx`

```typescript
import { PremiumPageGuard } from './components/Premium/PremiumPageGuard';

// Wrap premium routes:
<Route 
    path="/equipment" 
    element={
        <PremiumPageGuard
            feature="hasAdvancedTools"
            tierRequired="pro"
            title="ניהול ציוד"
            description="מעקב מתקדם אחר נשקים, ציוד ומלאי - זמין במסלול Pro"
        >
            <EquipmentManager />
        </PremiumPageGuard>
    } 
/>
```

---

## 🧪 Phase 3: Integration & Testing

### Step 3.1: Build Verification

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# TypeScript check
npx tsc --noEmit

# Build
npm run build
```

**Expected**: ✅ No errors

### Step 3.2: Manual Testing Checklist

Create a test organization with `tier = 'lite'` in Supabase:

```sql
UPDATE organizations 
SET tier = 'lite' 
WHERE name = 'Test Org';
```

#### **Test 1: Quota Enforcement**
- [ ] Try adding 51st soldier → Should show error
- [ ] Try adding 5th team → Should show error
- [ ] Try adding 6th role → Should show error

#### **Test 2: UI Guards**
- [ ] Navbar shows "PRO" badges on locked features
- [ ] Clicking locked feature opens UpgradeModal
- [ ] Equipment page shows full-page lock screen

#### **Test 3: Pro Tier**
```sql
UPDATE organizations SET tier = 'pro' WHERE name = 'Test Org';
```
- [ ] All features unlocked
- [ ] No quota errors
- [ ] No "PRO" badges visible

#### **Test 4: Battalion Tier**
```sql
UPDATE organizations SET tier = 'battalion' WHERE name = 'Test Org';
```
- [ ] Battalion dashboard accessible
- [ ] All other features work

### Step 3.3: Automated Tests (Optional)

```typescript
// Example test: src/__tests__/useSubscription.test.ts
import { renderHook } from '@testing-library/react';
import { useSubscription } from '../hooks/useSubscription';

test('Lite tier has correct limits', () => {
    const { result } = renderHook(() => useSubscription());
    
    expect(result.current.limits.maxPeople).toBe(50);
    expect(result.current.hasAccessTo('hasAdvancedTools')).toBe(false);
});
```

---

## 🚀 Phase 4: Deployment

### Step 4.1: Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Database migration verified in staging
- [ ] Code reviewed and approved
- [ ] Rollback plan ready
- [ ] Team notified of deployment

### Step 4.2: Deployment Steps

```bash
# 1. Merge to main
git checkout main
git pull origin main
git merge freemium-web
git push origin main

# 2. Deploy frontend (example for Vercel)
vercel --prod

# 3. Run database migration in production
# (Use Supabase Dashboard → SQL Editor)
```

### Step 4.3: Post-Deployment Verification

```bash
# Check production logs
# Verify no errors in Sentry/monitoring

# Test with real user account
# 1. Login to production
# 2. Check tier display
# 3. Test one locked feature
```

### Step 4.4: Gradual Rollout (Recommended)

Instead of changing all orgs at once:

```sql
-- Week 1: Convert 10% of orgs to Lite for testing
UPDATE organizations 
SET tier = 'lite' 
WHERE id IN (
    SELECT id FROM organizations 
    WHERE tier = 'pro' 
    ORDER BY RANDOM() 
    LIMIT (SELECT COUNT(*) * 0.1 FROM organizations)
);

-- Week 2: Monitor feedback, adjust limits if needed

-- Week 3: Full rollout
-- (Keep existing orgs as 'pro', only new signups get 'lite')
```

---

## 🔄 Rollback Plan

### If Something Goes Wrong

#### **Option 1: Revert Database** (Nuclear option)
```sql
-- Remove tier column (reverts to pre-freemium state)
ALTER TABLE organizations DROP COLUMN tier;
DROP TRIGGER IF EXISTS trigger_enforce_soldier_limit ON people;
DROP TRIGGER IF EXISTS trigger_enforce_team_limit ON teams;
DROP TRIGGER IF EXISTS trigger_enforce_role_limit ON roles;
```

#### **Option 2: Set All to Pro** (Soft rollback)
```sql
-- Keep infrastructure but disable limits
UPDATE organizations SET tier = 'pro';
```

#### **Option 3: Revert Frontend Only**
```bash
git revert <commit-hash>
git push origin main
vercel --prod
```

---

## ❓ FAQ & Troubleshooting

### Q: Will existing users be affected?
**A**: No. The migration sets all existing organizations to `tier = 'pro'`, so they keep all features.

### Q: What happens to new signups?
**A**: New organizations will default to `tier = 'lite'` (configurable in signup logic).

### Q: Can users upgrade themselves?
**A**: Currently, the UpgradeModal shows a contact form. You'll need to manually update their tier in Supabase after payment.

### Q: How do I change an organization's tier?
```sql
UPDATE organizations 
SET tier = 'pro' 
WHERE id = '<organization-id>';
```

### Q: Error: "Cannot read property 'tier' of undefined"
**A**: The organization object isn't loaded yet. Add a loading check:
```typescript
if (!organization) return <Spinner />;
```

### Q: Triggers not firing?
**A**: Check trigger status:
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_name LIKE '%enforce%';
```

### Q: I want different limits for Lite tier
**A**: Edit `src/constants/limits.ts`:
```typescript
lite: {
    maxPeople: 100, // Change from 50 to 100
    // ...
}
```

---

## 📞 Support

For issues or questions:
1. Check this README first
2. Review the code in `src/components/Premium/`
3. Contact: [Your Contact Info]

---

## 📝 Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-01 | 1.0.0 | Initial freemium implementation |

---

**🎉 You're Done!**

Your Miuim system now has a fully functional freemium model. All existing users keep their features, and you can now offer tiered pricing to new customers.
