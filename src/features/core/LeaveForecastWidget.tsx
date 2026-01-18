import React, { useEffect, useState } from 'react';
import { Person, Absence, TeamRotation, HourlyBlockage } from '../../types';
import { addDays, differenceInDays, isSameDay, format } from 'date-fns';
import { House, CalendarBlank as Calendar, Clock, Buildings, HouseIcon } from '@phosphor-icons/react';
import { getEffectiveAvailability } from '../../utils/attendanceUtils';
import { logger } from '../../services/loggingService';

interface TimelinePeriod {
    type: 'home' | 'base';
    startDate: Date;
    endDate: Date;
    durationDays: number;
    daysUntil: number;
    departureTime?: string;
    departureDate?: Date;
    returnTime?: string;
    returnDate?: Date;
    homeStatusType?: string;
}

interface LeaveForecastWidgetProps {
    myPerson: Person;
    forecastDays: number;
    onNavigate: (view: any, date?: Date) => void;
    absences: Absence[];
    teamRotations: TeamRotation[];
    hourlyBlockages: HourlyBlockage[];
}

export const LeaveForecastWidget: React.FC<LeaveForecastWidgetProps> = ({
    myPerson,
    forecastDays,
    onNavigate,
    absences,
    teamRotations,
    hourlyBlockages
}) => {
    const [timelinePeriods, setTimelinePeriods] = useState<TimelinePeriod[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!myPerson) return;
        setLoading(true);

        const periods: TimelinePeriod[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fetch availability for a wider range to catch boundary transitions [-1, forecastDays + 1]
        const availMap = new Map<string, any>();
        for (let i = -1; i <= forecastDays + 1; i++) {
            const date = addDays(today, i);
            const dateKey = format(date, 'yyyy-MM-dd');
            const avail = getEffectiveAvailability(myPerson, date, teamRotations, absences, hourlyBlockages);
            availMap.set(dateKey, { ...avail, date });
        }

        let currentPeriod: { type: 'home' | 'base'; start: Date; end: Date; homeStatusType?: string } | null = null;

        for (let i = 0; i <= forecastDays; i++) {
            const date = addDays(today, i);
            const dateKey = format(date, 'yyyy-MM-dd');
            const avail = availMap.get(dateKey);

            const isHome = avail.isAvailable === false || avail.status === 'home' || avail.status === 'departure' || avail.status === 'leave';
            const recordType = isHome ? 'home' : 'base';

            if (!currentPeriod) {
                currentPeriod = {
                    type: recordType,
                    start: date,
                    end: date,
                    homeStatusType: avail.homeStatusType
                };
            } else {
                // Merge consecutive days of same type
                // WE DON'T check homeStatusType here anymore to allow merging multiple home days with different subtypes
                if (recordType === currentPeriod.type) {
                    currentPeriod.end = date;
                    // If the new day has a homeStatusType and the current period doesn't, adopt it (for better labels)
                    if (!currentPeriod.homeStatusType && avail.homeStatusType) {
                        currentPeriod.homeStatusType = avail.homeStatusType;
                    }
                } else {
                    // Close current period
                    periods.push({
                        type: currentPeriod.type,
                        startDate: currentPeriod.start,
                        endDate: currentPeriod.end,
                        durationDays: differenceInDays(currentPeriod.end, currentPeriod.start) + 1,
                        daysUntil: differenceInDays(currentPeriod.start, today),
                        homeStatusType: currentPeriod.homeStatusType
                    });

                    // Start new period
                    currentPeriod = {
                        type: recordType,
                        start: date,
                        end: date,
                        homeStatusType: avail.homeStatusType
                    };
                }
            }
        }

        if (currentPeriod) {
            periods.push({
                type: currentPeriod.type,
                startDate: currentPeriod.start,
                endDate: currentPeriod.end,
                durationDays: differenceInDays(currentPeriod.end, currentPeriod.start) + 1,
                daysUntil: differenceInDays(currentPeriod.start, today),
                homeStatusType: currentPeriod.homeStatusType
            });
        }

        // Post-process home periods to find accurate exit/return times
        const finalPeriods = periods.map(p => {
            if (p.type !== 'home') return p;

            let departureDate = p.startDate;
            let departureTime = '00:00';
            let returnDate = addDays(p.endDate, 1);
            let returnTime = '00:00';

            // Check day before for departure
            const dayBefore = addDays(p.startDate, -1);
            const availBefore = availMap.get(format(dayBefore, 'yyyy-MM-dd'));
            if (availBefore && (availBefore.status === 'departure' || availBefore.isAvailable)) {
                departureDate = dayBefore;
                // If it's a departure or just a base day before home, and end hour is default, use 14:00 as default
                departureTime = (availBefore.endHour === '23:59' || availBefore.endHour === '00:00' || !availBefore.endHour) ? '14:00' : availBefore.endHour;
            }

            // Check day after for return
            const dayAfter = addDays(p.endDate, 1);
            const availAfter = availMap.get(format(dayAfter, 'yyyy-MM-dd'));
            if (availAfter && (availAfter.status === 'arrival' || availAfter.isAvailable)) {
                returnDate = dayAfter;
                // If it's an arrival or just a base day after home, and start hour is default, use 10:00 as default
                returnTime = (availAfter.startHour === '00:00' || !availAfter.startHour) ? '10:00' : availAfter.startHour;
            }

            return {
                ...p,
                departureDate, // New field to handle date transition
                departureTime,
                returnDate,    // New field to handle date transition
                returnTime
            };
        });

        setTimelinePeriods(finalPeriods);
        setLoading(false);
    }, [myPerson, forecastDays, absences, teamRotations, hourlyBlockages]);

    const formatDateRange = (start: Date, end: Date) => {
        const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
        const isSameMonth = start.getMonth() === end.getMonth();

        if (isSameDay(start, end)) {
            return `${start.getDate()} ב${months[start.getMonth()]}`;
        }
        if (isSameMonth) {
            return `${start.getDate()}-${end.getDate()} ב${months[start.getMonth()]}`;
        }
        return `${start.getDate()} ב${months[start.getMonth()]} - ${end.getDate()} ב${months[end.getMonth()]}`;
    };

    const formatTime = (time?: string) => {
        if (!time) return null;
        // Convert "HH:MM:SS" to "HH:MM"
        return time.substring(0, 5);
    };

    const getReturnDate = (endDate: Date) => {
        // Return is the day after the last home day
        return addDays(endDate, 1);
    };

    if (loading) {
        return (
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-6 md:p-8">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-slate-200 rounded w-1/3"></div>
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-32 bg-slate-100 rounded-2xl"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm border border-slate-100 p-4 md:p-8 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-48 h-48 bg-emerald-50 rounded-full blur-3xl opacity-40 -translate-y-1/2 -translate-x-1/2" aria-hidden="true"></div>

            <div className="relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between pb-2 md:pb-4 border-b border-slate-100 mb-3 md:mb-6">
                    <h2 className="text-lg md:text-2xl font-black text-slate-900 flex items-center gap-2 md:gap-3">
                        <div className="w-7 h-7 md:w-10 md:h-10 bg-emerald-100 rounded-lg md:rounded-xl flex items-center justify-center">
                            <HouseIcon size={16} className="text-emerald-600 md:hidden" weight="duotone" />
                            <HouseIcon size={20} className="text-emerald-600 hidden md:block" weight="duotone" />
                        </div>
                        צפי יציאות
                    </h2>
                    <span className="text-[9px] md:text-[11px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 md:px-3 md:py-1.5 rounded-full">
                        {forecastDays} ימים קדימה
                    </span>
                </div>

                {/* Timeline */}
                {timelinePeriods.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-slate-400">
                            <Calendar size={32} weight="duotone" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">אין נתונים</h3>
                        <p className="text-slate-500 mt-1">לא נמצאו נתוני נוכחות בטווח הזמן שנבחר.</p>
                        <button
                            onClick={() => {
                                logger.logClick('view_full_attendance', 'LeaveForecastWidget');
                                onNavigate('attendance');
                            }}
                            className="mt-4 text-emerald-600 font-bold text-sm hover:underline"
                        >
                            עבור ללוח נוכחות מלא
                        </button>
                    </div>
                ) : (
                    <div className="relative">
                        {/* Timeline connector line */}
                        <div className="absolute top-0 bottom-0 right-6 w-0.5 bg-slate-200" aria-hidden="true"></div>

                        <div className="space-y-4">
                            {timelinePeriods.map((period, index) => {
                                const isHome = period.type === 'home';
                                const isToday = period.daysUntil === 0;
                                const bgColor = isHome ? 'from-rose-50 to-white' : 'from-emerald-50 to-white';
                                const borderColor = isHome ? 'border-rose-200' : 'border-emerald-200';
                                const iconBg = isHome ? 'bg-rose-100' : 'bg-emerald-100';
                                const iconColor = isHome ? 'text-rose-600' : 'text-emerald-600';
                                const dotColor = isHome ? 'bg-rose-500' : 'bg-emerald-500';

                                return (
                                    <div
                                        key={index}
                                        onClick={() => {
                                            logger.logClick('timeline_period_card', 'LeaveForecastWidget');
                                            onNavigate('attendance', period.startDate);
                                        }}
                                        className={`relative bg-gradient-to-br ${bgColor} rounded-lg md:rounded-2xl p-3 md:p-5 border ${borderColor} hover:shadow-lg transition-all cursor-pointer group`}
                                    >
                                        {/* Timeline dot */}
                                        <div className={`absolute right-[18px] top-6 w-4 h-4 ${dotColor} rounded-full border-4 border-white shadow-sm z-10`}></div>

                                        <div className="mr-8">
                                            {/* Header with icon and date range */}
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-2 md:gap-3">
                                                    <div className={`w-8 h-8 md:w-12 md:h-12 ${iconBg} rounded-lg md:rounded-xl flex items-center justify-center shrink-0`}>
                                                        {isHome ? (
                                                            <House size={16} className={`${iconColor} md:hidden`} weight="duotone" />
                                                        ) : (
                                                            <Buildings size={16} className={`${iconColor} md:hidden`} weight="duotone" />
                                                        )}
                                                        {isHome ? (
                                                            <House size={24} className={`${iconColor} hidden md:block`} weight="duotone" />
                                                        ) : (
                                                            <Buildings size={24} className={`${iconColor} hidden md:block`} weight="duotone" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-slate-900 text-sm md:text-lg">
                                                            {formatDateRange(period.startDate, period.endDate)}
                                                        </h3>
                                                        <p className="text-[10px] md:text-sm font-bold text-slate-600 leading-none">
                                                            {period.durationDays} {period.durationDays === 1 ? 'יום' : 'ימים'} {isHome ? 'בבית' : 'בבסיס'}
                                                        </p>
                                                    </div>
                                                </div>
                                                {isToday && (
                                                    <span className={`${isHome ? 'bg-rose-600' : 'bg-emerald-600'} text-white text-[10px] px-2 py-1 rounded-full font-black uppercase tracking-wider`}>
                                                        היום
                                                    </span>
                                                )}
                                            </div>

                                            {/* Times for home periods */}
                                            {isHome && (
                                                <div className="grid grid-cols-2 gap-3 mt-3">
                                                    {period.departureTime && (
                                                        <div className="bg-white/60 rounded-lg p-2 md:p-3 border border-emerald-100">
                                                            <div className={`flex items-center gap-2 ${isHome ? 'text-rose-700' : 'text-emerald-700'} mb-1`}>
                                                                <Clock size={12} weight="duotone" />
                                                                <span className="text-[10px] md:text-xs font-black uppercase">יציאה</span>
                                                            </div>
                                                            <p className="text-xs md:text-sm font-bold text-slate-900">
                                                                {format(period.departureDate || period.startDate, 'd/M')} {formatTime(period.departureTime)}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {period.returnTime && (
                                                        <div className="bg-white/60 rounded-lg p-2 md:p-3 border border-emerald-100">
                                                            <div className={`flex items-center gap-2 ${isHome ? 'text-rose-700' : 'text-emerald-700'} mb-1`}>
                                                                <Clock size={12} weight="duotone" />
                                                                <span className="text-[10px] md:text-xs font-black uppercase">חזרה</span>
                                                            </div>
                                                            <p className="text-xs md:text-sm font-bold text-slate-900">
                                                                {format(period.returnDate || getReturnDate(period.endDate), 'd/M')} {formatTime(period.returnTime)}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
