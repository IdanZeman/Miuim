import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';

export const getOrCreateProfile = async (req: AuthRequest, res: Response) => {
    const user = req.user;
    const authHeader = req.headers.authorization;

    if (!user || !authHeader) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    // Use request-specific client with user's token to comply with RLS
    // Note: Since we are using the ANON_KEY, everything is subject to RLS policies.
    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
        {
            global: {
                headers: {
                    Authorization: authHeader
                }
            }
        }
    );

    const userId = user.id;

    try {
        // 1. Check if profile exists
        const { data: profile, error: profileError } = await userClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (profileError) {
            console.error('Error fetching profile:', profileError);
            return res.status(500).json({ error: 'Failed to fetch profile' });
        }

        if (profile) {
            return res.json(profile);
        }

        // 2. Profile doesn't exist, create it
        const email = user.email;
        const phone = user.phone;
        const fullName = user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            (email ? email.split('@')[0] : null) ||
            phone ||
            'New User';

        // 3. Find matching person record
        // Note: Using service role here so we can search the entire 'people' table
        let existingPerson: any = null;

        if (email || phone) {
            let personQuery = userClient
                .from('people')
                .select('id, organization_id');

            if (email && phone) {
                personQuery = personQuery.or(`email.eq.${email},phone.eq.${phone}`);
            } else if (email) {
                personQuery = personQuery.eq('email', email);
            } else if (phone) {
                personQuery = personQuery.eq('phone', phone);
            }

            const { data: personData, error: personError } = await personQuery.limit(1).maybeSingle();

            if (!personError && personData) {
                existingPerson = personData;
            } else if (personError) {
                console.warn('Error searching for existing person:', personError);
            }
        }

        // 4. Create profile
        const { data: newProfile, error: createError } = await userClient
            .from('profiles')
            .insert({
                id: userId,
                email: email,
                full_name: fullName,
                organization_id: existingPerson?.organization_id || null,
                permissions: {
                    dataScope: "personal",
                    screens: {},
                    canApproveRequests: false,
                    canManageRotaWizard: false
                },
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (createError) {
            console.error('Error creating profile:', createError);
            return res.status(500).json({ error: 'Failed to create profile' });
        }

        // 5. Link person to user
        if (existingPerson?.id) {
            const { error: linkError } = await userClient
                .from('people')
                .update({ user_id: userId })
                .eq('id', existingPerson.id);

            if (linkError) {
                console.error('Error linking person to user:', linkError);
                // We don't return 500 here since the profile was already created
            }
        }

        return res.json(newProfile);

    } catch (err) {
        console.error('getOrCreateProfile implementation error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
