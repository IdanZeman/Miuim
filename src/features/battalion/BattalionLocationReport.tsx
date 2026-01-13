
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Person, Shift, TaskTemplate, Team, Organization, TeamRotation, Absence, PersonLocation, LocationStatus } from '../../types';
import { MapPin, House as Home, Briefcase, Funnel as Filter, Copy, CaretDown as ChevronDown, Users, SquaresFour as LayoutGrid, ArrowsDownUp as ArrowUpDown, User, CaretRight as ChevronRight, CaretLeft as ChevronLeft, Clock, DotsThreeVertical as MoreVertical, CircleNotch as Loader2, Buildings, ArrowsDownUpIcon } from '@phosphor-icons/react';
import { getEffectiveAvailability } from '../../utils/attendanceUtils';
import { useToast } from '../../contexts/ToastContext';
import { Select } from '../../components/ui/Select';
import { DateNavigator } from '../../components/ui/DateNavigator';
import { TimePicker } from '../../components/ui/DatePicker';
import { logger } from '../../services/loggingService';
import { ExportButton } from '../../components/ui/ExportButton';
import { GenericModal } from '../../components/ui/GenericModal';
import { useAuth } from '../auth/AuthContext';
import { useBattalionData } from '../../hooks/useBattalionData';
import { generateLocationReportExcel } from '../../utils/excelExport';

// Local type definitions removed in favor of src/types.ts

// --- Sub-components for better performance ---

const PersonCard = React.memo(({ r, showStatusBadge, showOrg }: { r: PersonLocation; showStatusBadge?: boolean; showOrg?: boolean }) => {
    return (
        <div className="p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors flex items-start text-right bg-white rounded-xl shadow-sm md:shadow-none md:rounded-none">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-slate-800 text-sm truncate">{r.person.name}</span>
                    {showStatusBadge && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${r.status === 'mission' ? 'bg-rose-100 text-rose-700' : r.status === 'base' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {r.status === 'mission' ? 'משימה' : r.status === 'base' ? 'בסיס' : 'בית'}
                        </span>
                    )}
                </div>
                {showOrg && <span className="text-[10px] text-blue-600 font-bold">{r.orgName}</span>}
            </div>

            <div className="flex flex-col items-end gap-1 pl-2">
                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[140px]">
                    {r.details}
                </span>
                {r.time && r.time !== 'כל היום' && (
                    <span dir="ltr" className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 rounded">
                        {r.time}
                    </span>
                )}
            </div>
        </div>
    );
});

const SectionHeader = React.memo(({
    sectionKey,
    title,
    count,
    icon,
    bgClass,
    borderClass,
    isSmall = false,
    isExpanded,
    onToggle,
    stickyConfig
}: {
    sectionKey: string;
    title: string;
    count: number;
    icon: React.ReactNode;
    bgClass: string;
    borderClass: string;
    isSmall?: boolean;
    isExpanded: boolean;
    onToggle: (key: string) => void;
    stickyConfig: string;
}) => (
    <div
        onClick={(e) => { e.stopPropagation(); onToggle(sectionKey); }}
        className={`sticky ${stickyConfig} flex items-center justify-between font-bold text-slate-700 mb-2 rounded-xl border-2 cursor-pointer select-none transition-all ${bgClass} ${borderClass} ${isSmall ? 'p-2 mt-2 shadow-sm' : 'p-3 shadow-md'}`}
    >
        <div className="flex items-center gap-3">
            {icon}
            <span className={isSmall ? 'text-sm' : 'text-base'}>{title} <span className="text-slate-400 font-black text-xs ml-1">({count})</span></span>
        </div>
        <ChevronDown
            size={isSmall ? 14 : 18}
            className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
            weight="bold"
        />
    </div>
));

const StatusGroup = React.memo(({
    statusKey,
    title,
    data,
    icon,
    bgClass,
    borderClass,
    expanded,
    onToggle
}: {
    statusKey: string;
    title: string;
    data: PersonLocation[];
    icon: React.ReactNode;
    bgClass: string;
    borderClass: string;
    expanded: boolean;
    onToggle: (key: string) => void;
}) => {
    // Only render empty groups? Original code rendered empty groups if they existed in filtered set?
    // Actually original code did `groupedByStatus.mission.length > 0` check.
    // We'll pass length and check here.
    return (
        <div>
            <SectionHeader
                sectionKey={statusKey}
                title={title}
                count={data.length}
                icon={icon}
                bgClass={bgClass}
                borderClass={borderClass}
                isSmall={true}
                isExpanded={expanded}
                onToggle={onToggle}
                stickyConfig="top-[190px] md:top-[149px] z-10"
            />
            {expanded && data.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                    {data.map(r => <PersonCard key={r.person.id} r={r} />)}
                </div>
            )}
        </div>
    );
});

const CompanySection = React.memo(({
    company,
    companyData,
    isExpanded,
    isMissionExpanded,
    isBaseExpanded,
    isHomeExpanded,
    isInactiveExpanded,
    onToggle
}: {
    company: Organization;
    companyData: PersonLocation[];
    isExpanded: boolean;
    isMissionExpanded: boolean;
    isBaseExpanded: boolean;
    isHomeExpanded: boolean;
    isInactiveExpanded: boolean;
    onToggle: (key: string) => void;
}) => {
    const companyKey = `org-${company.id}`;

    // We memoize grouped data so it doesn't recalc on toggle unless companyData changes
    const groupedByStatus = useMemo(() => ({
        mission: companyData.filter(r => r.status === 'mission'),
        base: companyData.filter(r => r.status === 'base'),
        home: companyData.filter(r => r.status === 'home'),
        inactive: companyData.filter(r => r.status === 'inactive')
    }), [companyData]);

    return (
        <section className="bg-white rounded-2xl border border-slate-100 p-2 shadow-sm">
            <SectionHeader
                sectionKey={companyKey}
                title={company.name}
                count={companyData.length}
                icon={<Buildings size={22} className="text-blue-600" weight="bold" />}
                bgClass="bg-slate-50 hover:bg-slate-100"
                borderClass="border-slate-100"
                isExpanded={isExpanded}
                onToggle={onToggle}
                stickyConfig="top-[130px] md:top-[89px] z-20"
            />

            {isExpanded && (
                <div className="mt-2 space-y-4 px-1 pb-2">
                    <StatusGroup
                        statusKey={`${companyKey}-mission`}
                        title="במשימה"
                        data={groupedByStatus.mission}
                        icon={<Briefcase size={16} className="text-rose-500" weight="bold" />}
                        bgClass="bg-rose-50 hover:bg-rose-100 border-rose-100"
                        borderClass="border-rose-100"
                        expanded={isMissionExpanded}
                        onToggle={onToggle}
                    />
                    <StatusGroup
                        statusKey={`${companyKey}-base`}
                        title="בבסיס"
                        data={groupedByStatus.base}
                        icon={<MapPin size={16} className="text-emerald-600" weight="bold" />}
                        bgClass="bg-emerald-50 hover:bg-emerald-100 border-emerald-100"
                        borderClass="border-emerald-100"
                        expanded={isBaseExpanded}
                        onToggle={onToggle}
                    />
                    <StatusGroup
                        statusKey={`${companyKey}-home`}
                        title="בבית"
                        data={groupedByStatus.home}
                        icon={<Home size={16} className="text-slate-500" weight="bold" />}
                        bgClass="bg-slate-50 hover:bg-slate-100 border-slate-200"
                        borderClass="border-slate-200"
                        expanded={isHomeExpanded}
                        onToggle={onToggle}
                    />
                    {groupedByStatus.inactive.length > 0 && (
                        <StatusGroup
                            statusKey={`${companyKey}-inactive`}
                            title="לא פעילים"
                            data={groupedByStatus.inactive}
                            icon={<User size={16} className="text-slate-400" weight="bold" />}
                            bgClass="bg-slate-100 hover:bg-slate-200 border-slate-200"
                            borderClass="border-slate-200"
                            expanded={isInactiveExpanded}
                            onToggle={onToggle}
                        />
                    )}
                </div>
            )}
        </section>
    );
});

export const BattalionLocationReport: React.FC = () => {
    const { organization } = useAuth();
    const { showToast } = useToast();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedTime, setSelectedTime] = useState<string>('08:00');
    const [filterCompany, setFilterCompany] = useState<string>('all');
    const [groupBy, setGroupBy] = useState<'company' | 'status' | 'alpha'>('company');
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);

    const {
        companies = [],
        people = [],
        shifts = [],
        taskTemplates = [],
        teamRotations = [],
        absences = [],
        hourlyBlockages = [],
        isLoading
    } = useBattalionData(organization?.battalion_id, selectedDate.toISOString().split('T')[0]);

    const toggleSection = useCallback((section: string) => {
        setExpanded(prev => ({ ...prev, [section]: !(prev[section] ?? true) }));
    }, []);

    const handleExportExcel = async () => {
        const dataForExport = reportData.filter(r => r.status !== 'inactive'); // Exclude inactive from Excel
        await generateLocationReportExcel(
            dataForExport,
            `battalion_location_${selectedDate.toISOString().split('T')[0]}`,
            true // isBattalionReport
        );
    };

    // Memoize the report generation! Critical for performance.
    const allReportData = useMemo(() => {
        const checkTime = new Date(selectedDate);
        const [hours, minutes] = selectedTime.split(':').map(Number);
        checkTime.setHours(hours, minutes, 0, 0);

        return people.map(person => {
            const org = companies.find(c => c.id === person.organization_id);
            const orgName = org?.name || 'ללא פלוגה';

            // Check if inactive
            if (person.isActive === false) {
                return {
                    person,
                    status: 'inactive' as LocationStatus,
                    details: 'לא פעיל (בבסיס)',
                    time: 'קבוע',
                    orgName,
                    orgId: person.organization_id || ''
                };
            }

            // 1. Check if in active shift
            const activeShift = shifts.find(s => {
                const start = new Date(s.startTime);
                const end = new Date(s.endTime);
                return s.assignedPersonIds.includes(person.id) && start <= checkTime && end >= checkTime;
            });

            if (activeShift) {
                const task = taskTemplates.find(t => t.id === activeShift.taskId);
                return {
                    person,
                    status: 'mission' as LocationStatus,
                    details: task?.name || 'משימה',
                    time: `${new Date(activeShift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false })} - ${new Date(activeShift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false })}`,
                    orgName,
                    orgId: person.organization_id || ''
                };
            }

            // 2. Check Attendance
            const avail = getEffectiveAvailability(person, checkTime, teamRotations, absences, hourlyBlockages);

            if (avail.status === 'arrival') {
                const [sH, sM] = (avail.startHour || '00:00').split(':').map(Number);
                const arrivalTime = new Date(checkTime);
                arrivalTime.setHours(sH, sM, 0, 0);

                if (checkTime < arrivalTime) {
                    return {
                        person,
                        status: 'home' as LocationStatus,
                        details: `בבית (מגיע ב-${avail.startHour})`,
                        time: avail.startHour ? `${avail.startHour} - ${avail.endHour || '23:59'}` : '08:00 - 17:00',
                        orgName,
                        orgId: person.organization_id || ''
                    };
                }
                return {
                    person,
                    status: 'base' as LocationStatus,
                    details: avail.startHour ? `הגעה ב-${avail.startHour}` : 'הגעה לבסיס',
                    time: avail.startHour ? `${avail.startHour} - ${avail.endHour || '23:59'}` : '08:00 - 17:00',
                    orgName,
                    orgId: person.organization_id || ''
                };
            }

            if (avail.status === 'departure') {
                const [eH, eM] = (avail.endHour || '23:59').split(':').map(Number);
                const departureTime = new Date(checkTime);
                departureTime.setHours(eH, eM, 0, 0);

                if (checkTime < departureTime) {
                    return {
                        person,
                        status: 'base' as LocationStatus,
                        details: avail.endHour ? `יציאה ב-${avail.endHour}` : 'יציאה הביתה',
                        time: avail.endHour ? `${avail.startHour || '00:00'} - ${avail.endHour}` : '08:00 - 17:00',
                        orgName,
                        orgId: person.organization_id || ''
                    };
                }
                return {
                    person,
                    status: 'home' as LocationStatus,
                    details: `בבית (יצא ב-${avail.endHour})`,
                    time: avail.endHour ? `${avail.startHour || '00:00'} - ${avail.endHour}` : '08:00 - 17:00',
                    orgName,
                    orgId: person.organization_id || ''
                };
            }

            if (!avail.isAvailable || avail.status === 'home' || avail.status === 'unavailable') {
                return {
                    person,
                    status: 'home' as LocationStatus,
                    details: 'בבית',
                    time: 'כל היום',
                    orgName,
                    orgId: person.organization_id || ''
                };
            }

            const isFullDay = (!avail.startHour || avail.startHour === '00:00') && (!avail.endHour || avail.endHour === '23:59');

            return {
                person,
                status: 'base' as LocationStatus,
                details: 'בבסיס (זמין)',
                time: isFullDay ? '' : (avail.startHour ? `${avail.startHour} - ${avail.endHour}` : '08:00 - 17:00'),
                orgName,
                orgId: person.organization_id || ''
            };
        });
    }, [selectedDate, selectedTime, people, shifts, taskTemplates, teamRotations, absences, hourlyBlockages, companies]);

    // Memoize the filtered data
    const reportData = useMemo(() => allReportData.filter(r => filterCompany === 'all' || r.orgId === filterCompany), [allReportData, filterCompany]);

    // Pre-calculate grouped data to ensure stable references for child components
    const groupedData = useMemo(() => {
        const grouped: Record<string, PersonLocation[]> = {};
        companies.forEach(company => {
            grouped[company.id] = reportData.filter(r => r.orgId === company.id);
        });
        return grouped;
    }, [reportData, companies]);

    useEffect(() => {
        logger.info('VIEW', 'Viewed Battalion Location Report', {
            date: selectedDate.toISOString().split('T')[0],
            time: selectedTime,
            filterCompany,
            groupBy,
            category: 'stats'
        });
    }, [selectedDate, selectedTime, filterCompany, groupBy]);

    const renderContent = () => {
        if (groupBy === 'company') {
            return (
                <div className="space-y-6 px-1">
                    {companies.map(company => {
                        const companyData = groupedData[company.id] || [];
                        if (companyData.length === 0) return null;

                        const companyKey = `org-${company.id}`;
                        return (
                            <CompanySection
                                key={company.id}
                                company={company}
                                companyData={companyData}
                                isExpanded={expanded[companyKey] ?? true}
                                isMissionExpanded={expanded[`${companyKey}-mission`] ?? true}
                                isBaseExpanded={expanded[`${companyKey}-base`] ?? true}
                                isHomeExpanded={expanded[`${companyKey}-home`] ?? true}
                                isInactiveExpanded={expanded[`${companyKey}-inactive`] ?? true}
                                onToggle={toggleSection}
                            />
                        );
                    })}
                </div>
            );
        }

        if (groupBy === 'status') {
            const grouped = {
                mission: reportData.filter(r => r.status === 'mission'),
                base: reportData.filter(r => r.status === 'base'),
                home: reportData.filter(r => r.status === 'home'),
                inactive: reportData.filter(r => r.status === 'inactive')
            };

            const isExpanded = (key: string) => expanded[key] ?? true;

            const renderStatusSection = (key: string, title: string, data: PersonLocation[], icon: React.ReactNode, bgStr: string, borderStr: string) => (
                <section>
                    <SectionHeader
                        sectionKey={key}
                        title={title}
                        count={data.length}
                        icon={icon}
                        bgClass={bgStr}
                        borderClass={borderStr}
                        isExpanded={isExpanded(key)}
                        onToggle={toggleSection}
                        stickyConfig="top-[130px] md:top-[89px] z-20"
                    />
                    {isExpanded(key) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            {data.sort((a, b) => a.orgName.localeCompare(b.orgName) || a.person.name.localeCompare(b.person.name)).map(r => <PersonCard key={r.person.id} r={r} showOrg />)}
                        </div>
                    )}
                </section>
            );

            return (
                <div className="space-y-6 px-1">
                    {renderStatusSection('global-mission', 'במשימה', grouped.mission, <Briefcase size={22} className="text-rose-500" weight="bold" />, 'bg-rose-50 hover:bg-rose-100', 'border-rose-100')}
                    {renderStatusSection('global-base', 'בבסיס', grouped.base, <MapPin size={22} className="text-emerald-600" weight="bold" />, 'bg-emerald-50 hover:bg-emerald-100', 'border-emerald-100')}
                    {renderStatusSection('global-home', 'בבית', grouped.home, <Home size={22} className="text-slate-500" weight="bold" />, 'bg-slate-50 hover:bg-slate-100', 'border-slate-200')}
                    {grouped.inactive.length > 0 && renderStatusSection('global-inactive', 'לא פעילים', grouped.inactive, <User size={22} className="text-slate-400" weight="bold" />, 'bg-slate-100 hover:bg-slate-200', 'border-slate-200')}
                </div>
            );
        }

        const sorted = [...reportData].sort((a, b) => a.person.name.localeCompare(b.person.name));
        return (
            <div className="px-1">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {sorted.map(r => <PersonCard key={r.person.id} r={r} showStatusBadge showOrg />)}
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
                <p className="text-slate-500 font-bold">טוען נתוני גדוד...</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 min-h-full flex flex-col pb-20">
            <div className="bg-white p-4 md:p-6 border-b border-slate-200 sticky top-0 z-30 shadow-sm flex flex-col gap-4">
                <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center justify-between w-full md:w-auto">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
                                <MapPin size={24} weight="bold" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 tracking-tight">דוח מיקום גדודי</h2>
                                <p className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">תמונת מצב כוחות גדודית</p>
                            </div>
                        </div>

                        <button
                            onClick={() => setIsActionsMenuOpen(true)}
                            className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-500 active:bg-slate-100 transition-colors"
                        >
                            <MoreVertical size={20} weight="bold" />
                        </button>
                    </div>

                    <div className="hidden md:flex flex-wrap items-center gap-2">
                        <DateNavigator
                            date={selectedDate}
                            onDateChange={setSelectedDate}
                            mode="day"
                            className="h-10"
                        />
                        <TimePicker
                            label=""
                            value={selectedTime}
                            onChange={setSelectedTime}
                            className="w-28 h-10"
                        />
                        <div className="w-px h-6 bg-slate-200 mx-1" />

                        <div className="flex items-center gap-2">
                            <Select
                                triggerMode="icon"
                                value={filterCompany}
                                onChange={setFilterCompany}
                                options={[
                                    { value: 'all', label: 'כל הפלוגות' },
                                    ...companies.map(c => ({ value: c.id, label: c.name }))
                                ]}
                                placeholder="סינון לפי פלוגה"
                                icon={Users}
                                className="w-10 h-10 p-0 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                            />
                            <Select
                                triggerMode="icon"
                                value={groupBy}
                                onChange={(val) => setGroupBy(val as any)}
                                options={[
                                    { value: 'company', label: 'לפי פלוגה' },
                                    { value: 'status', label: 'לפי סטטוס' },
                                    { value: 'alpha', label: 'לפי א-ב' }
                                ]}
                                placeholder="מיון תצוגה"
                                icon={ArrowsDownUpIcon}
                                className="w-10 h-10 p-0 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                            />
                            <ExportButton
                                onExport={handleExportExcel}
                                iconOnly
                                variant="secondary"
                                className="w-10 h-10 rounded-xl"
                            />
                            <button
                                onClick={async () => {
                                    let text = `📍 *דוח מיקום גדודי* - ${selectedDate.toLocaleDateString('he-IL')}\n\n`;
                                    companies.forEach(company => {
                                        const companyData = allReportData.filter(r => r.orgId === company.id);
                                        if (companyData.length === 0) return;

                                        text += `🏢 *${company.name}* (${companyData.length}):\n`;
                                        const grouped = {
                                            mission: companyData.filter(r => r.status === 'mission'),
                                            base: companyData.filter(r => r.status === 'base'),
                                            home: companyData.filter(r => r.status === 'home')
                                        };
                                        if (grouped.mission.length) text += `• במשימה: ${grouped.mission.length}\n`;
                                        if (grouped.base.length) text += `• בבסיס: ${grouped.base.length}\n`;
                                        if (grouped.home.length) text += `• בבית: ${grouped.home.length}\n`;
                                        text += '\n';
                                    });

                                    try {
                                        await navigator.clipboard.writeText(text);
                                        showToast('הועתק', 'success');
                                    } catch (e) { showToast('שגיאה', 'error'); }
                                }}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shadow-sm"
                                title="העתק סיכום גדודי"
                            >
                                <Copy size={18} weight="bold" />
                            </button>
                        </div>
                    </div>

                    {/* Mobile: Date, Time */}
                    <div className="md:hidden flex items-center gap-2 w-full">
                        <DateNavigator
                            date={selectedDate}
                            onDateChange={setSelectedDate}
                            mode="day"
                            className="h-10 flex-1"
                            showTodayButton={false}
                        />

                        <TimePicker
                            label=""
                            value={selectedTime}
                            onChange={setSelectedTime}
                            className="w-24 h-10"
                        />
                    </div>
                </div>
            </div>

            {/* Mobile Actions Menu */}
            <GenericModal
                isOpen={isActionsMenuOpen}
                onClose={() => setIsActionsMenuOpen(false)}
                title="פעולות"
                size="sm"
            >
                <div className="flex flex-col gap-2 p-2">
                    <button
                        onClick={() => {
                            handleExportExcel();
                            setIsActionsMenuOpen(false);
                        }}
                        className="flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors text-right"
                    >
                        <div className="bg-white p-2 rounded-lg border border-slate-100 text-emerald-600 shadow-sm">
                            <LayoutGrid size={18} weight="bold" />
                        </div>
                        <span className="font-bold text-slate-800">ייצוא דוח גדודי</span>
                    </button>

                    <div className="border-t border-slate-100 my-2" />

                    <div className="px-2 py-2">
                        <label className="text-xs font-bold text-slate-500 mb-2 block">סינון לפי פלוגה</label>
                        <Select
                            value={filterCompany}
                            onChange={setFilterCompany}
                            options={[
                                { value: 'all', label: 'כל הפלוגות' },
                                ...companies.map(c => ({ value: c.id, label: c.name }))
                            ]}
                            className="w-full"
                        />
                    </div>

                    <div className="px-2 py-2">
                        <label className="text-xs font-bold text-slate-500 mb-2 block">מיון תצוגה</label>
                        <Select
                            value={groupBy}
                            onChange={(val) => setGroupBy(val as any)}
                            options={[
                                { value: 'company', label: 'לפי פלוגה' },
                                { value: 'status', label: 'לפי סטטוס' },
                                { value: 'alpha', label: 'לפי א-ב' }
                            ]}
                            className="w-full"
                        />
                    </div>
                </div>
            </GenericModal>

            <div className="max-w-7xl mx-auto w-full mt-6 flex-1 relative">
                {renderContent()}
            </div>
        </div>
    );
};
