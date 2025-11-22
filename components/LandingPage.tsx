import React from 'react';
import { Shield, Users, Calendar, Zap, ArrowLeft, CheckCircle } from 'lucide-react';

interface LandingPageProps {
    onGetStarted: () => void;
}

import { Layout } from './Layout';

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
    return (
        <Layout isPublic={true}>
            <div className="min-h-screen overflow-y-auto bg-gradient-to-br from-emerald-50 via-white to-yellow-50">
                {/* Hero Section */}
                <div className="container mx-auto px-4 py-16">
                    {/* Header Content - Logo is now in Layout, so we can remove the duplicate logo or keep a large hero version */}
                    <div className="text-center mb-16">
                        <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-6 leading-tight">
                            Miuim
                        </h1>
                        <h2 className="text-5xl md:text-6xl font-bold text-slate-800 mb-6 leading-tight">
                            ניהול כוח אדם<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-green-700">
                                חכם ויעיל
                            </span>
                        </h2>
                        <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-12">
                            מערכת מתקדמת לשיבוץ משמרות, ניהול נוכחות ואופטימיזציה אוטומטית של כוח האדם
                        </p>
                        <button
                            onClick={onGetStarted}
                            className="group bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-8 py-4 rounded-xl text-lg font-bold shadow-xl hover:shadow-2xl transition-all hover:scale-105 inline-flex items-center gap-3"
                        >
                            <span>התחל עכשיו</span>
                            <ArrowLeft className="group-hover:-translate-x-1 transition-transform" size={20} />
                        </button>
                    </div>

                    {/* Features Grid */}
                    <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mt-24">
                        <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-emerald-100 hover:border-emerald-300 transition-all hover:scale-105 hover:shadow-xl">
                            <div className="bg-emerald-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                                <Calendar className="text-emerald-600" size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 mb-4">שיבוץ אוטומטי</h3>
                            <p className="text-slate-600 leading-relaxed">
                                אלגוריתם חכם שמשבץ משמרות בצורה אופטימלית תוך התחשבות בזמינות, העדפות ומגבלות
                            </p>
                        </div>

                        <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-yellow-100 hover:border-yellow-300 transition-all hover:scale-105 hover:shadow-xl">
                            <div className="bg-yellow-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                                <Users className="text-yellow-600" size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 mb-4">ניהול צוות</h3>
                            <p className="text-slate-600 leading-relaxed">
                                מעקב אחר זמינות, נוכחות ומיומנויות של כל חבר צוות במקום אחד
                            </p>
                        </div>

                        <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-green-100 hover:border-green-300 transition-all hover:scale-105 hover:shadow-xl">
                            <div className="bg-green-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                                <Zap className="text-green-600" size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 mb-4">דוחות ותובנות</h3>
                            <p className="text-slate-600 leading-relaxed">
                                ניתוח מתקדם של עומסי עבודה, מגמות ואופטימיזציה מבוססת AI
                            </p>
                        </div>
                    </div>

                    {/* Benefits Section */}
                    <div className="max-w-4xl mx-auto mt-24 bg-white rounded-3xl shadow-xl p-12 border-2 border-yellow-200">
                        <h3 className="text-3xl font-bold text-slate-800 mb-8 text-center">למה Miuim?</h3>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="flex items-start gap-4">
                                <CheckCircle className="text-emerald-500 flex-shrink-0" size={24} />
                                <div>
                                    <h4 className="font-bold text-slate-800 mb-1">חיסכון בזמן</h4>
                                    <p className="text-slate-600">95% פחות זמן שיבוץ ידני</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <CheckCircle className="text-emerald-500 flex-shrink-0" size={24} />
                                <div>
                                    <h4 className="font-bold text-slate-800 mb-1">הוגנות מלאה</h4>
                                    <p className="text-slate-600">חלוקה שוויונית של עומסים</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <CheckCircle className="text-emerald-500 flex-shrink-0" size={24} />
                                <div>
                                    <h4 className="font-bold text-slate-800 mb-1">שקיפות מלאה</h4>
                                    <p className="text-slate-600">כולם רואים את אותו המידע</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <CheckCircle className="text-emerald-500 flex-shrink-0" size={24} />
                                <div>
                                    <h4 className="font-bold text-slate-800 mb-1">גישה 24/7</h4>
                                    <p className="text-slate-600">מכל מקום ומכל מכשיר</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-200 mt-24 bg-white">
                    <div className="container mx-auto px-4 py-8 text-center text-slate-500">
                        <p>© 2025 Miuim. כל הזכויות שמורות.</p>
                    </div>
                </div>
            </div>
        </Layout>
    );
};
