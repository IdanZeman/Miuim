import React from 'react';
import { Users, ClipboardList, Shield, ArrowRight, Plus, FileSpreadsheet } from 'lucide-react';

interface EmptyStateGuideProps {
    hasTasks: boolean;
    hasPeople: boolean;
    hasRoles: boolean;
    onNavigate: (view: 'personnel' | 'tasks', tab?: 'people' | 'roles' | 'teams') => void;
    onImport: () => void;
}

export const EmptyStateGuide: React.FC<EmptyStateGuideProps> = ({ hasTasks, hasPeople, hasRoles, onNavigate, onImport }) => {
    return (
        <div className="flex flex-col items-center justify-center py-48 px-4 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-8 max-w-2xl">
                <h2 className="text-3xl font-bold text-slate-800 mb-3">ברוכים הבאים למערכת שיבוץ משימות! </h2>
                <p className="text-slate-500 text-lg">
                    המערכת מוכנה לשימוש. כדי להתחיל לשבץ, עלינו להגדיר את נתוני הבסיס.
                    <br />
                    אנא עקוב אחר השלבים הבאים:
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10 max-w-5xl w-full">
                {/* Connecting Line (Desktop) */}
                <div className="hidden md:block absolute top-1/2 left-0 w-full h-1 bg-slate-100 -z-10 -translate-y-1/2 rounded-full"></div>

                {/* Step 1: Roles */}
                <div className={`p-6 rounded-2xl border-2 transition-all bg-white relative group ${!hasRoles ? 'border-blue-500 shadow-lg scale-105 ring-4 ring-blue-50' : 'border-slate-100 opacity-60'}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto transition-colors ${!hasRoles ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                        <Shield size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">1. הגדרת תפקידים</h3>
                    <p className="text-slate-500 text-sm mb-6">
                        הגדר את התפקידים השונים ביחידה (למשל: חובש, נהג, קשר)
                    </p>

                    {!hasRoles ? (
                        <button
                            onClick={() => onNavigate('personnel', 'roles')}
                            className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                        >
                            הוסף תפקידים
                            <Plus size={16} />
                        </button>
                    ) : (
                        <div className="flex items-center justify-center gap-2 text-green-600 font-bold bg-green-50 py-2 rounded-lg">
                            <span className="w-5 h-5 rounded-full bg-green-200 flex items-center justify-center text-xs">✓</span>
                            <span>הושלם</span>
                        </div>
                    )}
                </div>

                {/* Step 2: People */}
                <div className={`p-6 rounded-2xl border-2 transition-all bg-white relative group ${!hasPeople ? 'border-green-500 shadow-lg scale-105 ring-4 ring-green-50' : 'border-slate-100 opacity-60'}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto transition-colors ${!hasPeople ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                        <Users size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">2. הגדרת חיילים</h3>
                    <p className="text-slate-500 text-sm mb-6">
                        הזמן את חברי הצוות והגדר את התפקידים שלהם
                    </p>

                    {!hasPeople ? (
                        <button
                            onClick={() => onNavigate('personnel', 'people')}
                            className="w-full py-2.5 px-4 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                        >
                            הגדר חיילים
                            <Plus size={16} />
                        </button>
                    ) : (
                        <div className="flex items-center justify-center gap-2 text-green-600 font-bold bg-green-50 py-2 rounded-lg">
                            <span className="w-5 h-5 rounded-full bg-green-200 flex items-center justify-center text-xs">✓</span>
                            <span>הושלם</span>
                        </div>
                    )}
                </div>

                {/* Step 3: Tasks */}
                <div className={`p-6 rounded-2xl border-2 transition-all bg-white relative group ${!hasTasks ? 'border-purple-500 shadow-lg scale-105 ring-4 ring-purple-50' : 'border-slate-100 opacity-60'}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto transition-colors ${!hasTasks ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400'}`}>
                        <ClipboardList size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">3. יצירת משימות</h3>
                    <p className="text-slate-500 text-sm mb-6">
                        הגדר את סוגי המשמרות והמשימות (למשל: שמירה, סיור)
                    </p>

                    {!hasTasks ? (
                        <button
                            onClick={() => onNavigate('tasks')}
                            className="w-full py-2.5 px-4 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                        >
                            צור משימות
                            <Plus size={16} />
                        </button>
                    ) : (
                        <div className="flex items-center justify-center gap-2 text-green-600 font-bold bg-green-50 py-2 rounded-lg">
                            <span className="w-5 h-5 rounded-full bg-green-200 flex items-center justify-center text-xs">✓</span>
                            <span>הושלם</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Parallel Option: Import */}
            {!hasRoles && !hasPeople && (
                <div className="mt-12 w-full max-w-2xl bg-gradient-to-r from-green-50 to-teal-50 border border-green-200 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                    <div className="flex items-start gap-4 text-right">
                        <div className="bg-white p-3 rounded-xl shadow-sm border border-green-100 text-green-600">
                            <FileSpreadsheet size={32} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">יש לך כבר קובץ אקסל?</h3>
                            <p className="text-slate-600 text-sm mt-1">
                                דלג על השלבים הידניים וייבא את כל הנתונים (תפקידים, צוותים, וחיילים) במכה אחת.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onImport}
                        className="whitespace-nowrap px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                    >
                        ייבוא מהיר מאקסל
                    </button>
                </div>
            )}
        </div>
    );
};
