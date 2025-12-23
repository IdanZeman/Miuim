import React, { useState } from 'react';
import { Shield, Users, Sparkles } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export const CreateOrganizationPage: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [orgName, setOrgName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateOrganization = async () => {
    if (!orgName.trim() || !user) {
      showToast('נא להזין שם ארגון תקין', 'warning');
      return;
    }

    setIsCreating(true);

    try {
      // 1. Create Organization
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgName.trim(),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (orgError) {
        console.error('Error creating organization:', orgError);
        showToast('שגיאה ביצירת ארגון: ' + orgError.message, 'error');
        setIsCreating(false);
        return;
      }

      // 2. Update Profile with organization_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ organization_id: newOrg.id })
        .eq('id', user.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
        showToast('שגיאה בעדכון פרופיל: ' + profileError.message, 'error');
        setIsCreating(false);
        return;
      }

      // 3. Refresh auth context
      await refreshProfile();

      // Success - App.tsx will automatically route to main app
    } catch (error) {
      console.error('Unexpected error:', error);
      showToast('שגיאה לא צפויה', 'error');
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">ברוכים הבאים למערכת לניהול פלוגה משימות!</h1>
          <p className="text-slate-600">הגדר את הארגון שלך כדי להתחיל</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              שם הארגון / היחידה
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder='לדוגמה: "גדוד 101" או "פלוגה א׳"'
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all"
              disabled={isCreating}
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <Sparkles size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-bold mb-1">טיפ:</p>
              <p>תוכל להוסיף חברי צוות נוספים ולהגדיר הרשאות בהגדרות הארגון לאחר מכן.</p>
            </div>
          </div>

          <button
            onClick={handleCreateOrganization}
            disabled={isCreating || !orgName.trim()}
            className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white py-3 rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                יוצר ארגון...
              </>
            ) : (
              <>
                <Users size={20} />
                צור ארגון והתחל
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-slate-400 text-center mt-6">
          משתמש: {user?.email}
        </p>
      </div>
    </div>
  );
};
