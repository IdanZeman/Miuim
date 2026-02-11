import React, { useState, useEffect } from 'react';
import {
    Clock,
    Eye,
    Calendar,
    Shield,
    Users,
    Package,
    Database,
    ArrowsClockwise,
    FileText,
    CheckCircle
} from '@phosphor-icons/react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { snapshotService, Snapshot } from '../../../../services/snapshotService';
import { TableDataViewer } from './TableDataViewer';
import { getTableLabel } from '../utils/snapshotUtils';

interface SnapshotPreviewModalProps {
    snapshot: Snapshot;
    onClose: () => void;
    onRestore: (tables?: string[]) => void;
}

export const SnapshotPreviewModal: React.FC<SnapshotPreviewModalProps> = ({ snapshot, onClose, onRestore }) => {
    const [viewingTable, setViewingTable] = useState<string | null>(null);
    const [tableData, setTableData] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState(false);
    const [fetchProgress, setFetchProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [selectedTables, setSelectedTables] = useState<string[]>([]);

    const [peopleMap, setPeopleMap] = useState<Record<string, any>>({});
    const [teamsMap, setTeamsMap] = useState<Record<string, any>>({});
    const [rolesMap, setRolesMap] = useState<Record<string, any>>({});
    const [tasksMap, setTasksMap] = useState<Record<string, any>>({});
    const [equipmentMap, setEquipmentMap] = useState<Record<string, any>>({});
    const [absencesMap, setAbsencesMap] = useState<any[]>([]);
    const [rotationsMap, setRotationsMap] = useState<any[]>([]);
    const [blockagesMap, setBlockagesMap] = useState<any[]>([]);
    const [organizationsMap, setOrganizationsMap] = useState<any[]>([]);
    const [organizationSettingsMap, setOrganizationSettingsMap] = useState<any[]>([]);

    useEffect(() => {
        if (viewingTable) {
            loadTableData(viewingTable);
        }
    }, [viewingTable]);

    const loadTableData = async (tableName: string) => {
        try {
            setLoadingData(true);
            setFetchProgress(0);
            setError(null);

            // 1. Determine all dependencies needed for this table
            const dependencies: string[] = [];
            if (['shifts', 'absences', 'daily_presence', 'unified_presence', 'daily_attendance_snapshots', 'equipment', 'equipment_daily_checks'].includes(tableName)) {
                dependencies.push('people');
            }
            if (tableName === 'daily_presence' || tableName === 'unified_presence' || tableName === 'daily_attendance_snapshots') {
                dependencies.push('teams', 'absences', 'team_rotations', 'hourly_blockages', 'organizations', 'organization_settings');
            }
            if (tableName === 'people' || tableName === 'shifts') {
                dependencies.push('teams', 'roles');
            }
            if (tableName === 'shifts') {
                dependencies.push('task_templates');
            }
            if (tableName === 'equipment_daily_checks') {
                dependencies.push('equipment');
            }

            // 2. Filter for dependencies that are actually missing
            const missingDependencies = dependencies.filter(dep => {
                const stateMap: any = {
                    'people': peopleMap,
                    'teams': teamsMap,
                    'roles': rolesMap,
                    'task_templates': tasksMap,
                    'equipment': equipmentMap,
                    'absences': absencesMap,
                    'team_rotations': rotationsMap,
                    'hourly_blockages': blockagesMap,
                    'organizations': organizationsMap,
                    'organization_settings': organizationSettingsMap
                };
                const val = stateMap[dep];
                if (!val) return true; // Treat as missing if undefined/null
                return Array.isArray(val) ? val.length === 0 : Object.keys(val).length === 0;
            });

            // 3. Fetch primary table + all missing dependencies in parallel (but bundled)
            const [mainData, bundleData] = await Promise.all([
                snapshotService.fetchSnapshotTableData(snapshot.id, tableName, (p) => setFetchProgress(p)),
                missingDependencies.length > 0
                    ? snapshotService.fetchSnapshotDataBundle(snapshot.id, missingDependencies)
                    : Promise.resolve({})
            ]);

            // 4. Update states
            setTableData(mainData);

            if (bundleData.people) {
                const map: Record<string, any> = {};
                bundleData.people.forEach((item: any) => map[item.id] = item);
                setPeopleMap(map);
            }
            if (bundleData.teams) {
                const map: Record<string, any> = {};
                bundleData.teams.forEach((item: any) => map[item.id] = item);
                setTeamsMap(map);
            }
            if (bundleData.roles && bundleData.roles.length > 0) {
                const map: Record<string, any> = {};
                bundleData.roles.forEach((item: any) => map[item.id] = item);
                setRolesMap(map);
            } else {
                // FALLBACK: Fetch live roles if missing in snapshot
                console.log('[SnapshotPreview] Roles missing in snapshot. Fetching live roles...');
                const { data: liveRoles } = await snapshotService.supabase
                    .from('roles')
                    .select('*')
                    .eq('organization_id', snapshot.organization_id);

                if (liveRoles) {
                    console.log(`[SnapshotPreview] Fetched ${liveRoles.length} live roles.`);
                    const map: Record<string, any> = {};
                    liveRoles.forEach((item: any) => map[item.id] = item);
                    setRolesMap(map);
                } else {
                    console.warn('[SnapshotPreview] Failed to fetch live roles (null data).');
                }
            }
            if (bundleData.task_templates) {
                const map: Record<string, any> = {};
                bundleData.task_templates.forEach((item: any) => map[item.id] = item);
                setTasksMap(map);
            }
            if (bundleData.equipment) {
                const map: Record<string, any> = {};
                bundleData.equipment.forEach((item: any) => map[item.id] = item);
                setEquipmentMap(map);
            }
            if (bundleData.absences) setAbsencesMap(bundleData.absences);
            if (bundleData.team_rotations) setRotationsMap(bundleData.team_rotations);
            if (bundleData.hourly_blockages) setBlockagesMap(bundleData.hourly_blockages);
            if (bundleData.organizations) setOrganizationsMap(bundleData.organizations);
            if (bundleData.organization_settings) setOrganizationSettingsMap(bundleData.organization_settings);

        } catch (error: any) {
            console.error('Error loading table data:', error);
            setError(error.message || 'שגיאה בטעינת הנתונים');
        } finally {
            setLoadingData(false);
        }
    };

    const categories = [
        { id: 'people', icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
        { id: 'teams', icon: Shield, color: 'text-indigo-500', bg: 'bg-indigo-50' },
        { id: 'roles', icon: Shield, color: 'text-slate-500', bg: 'bg-slate-50' },
        { id: 'task_templates', icon: Package, color: 'text-emerald-500', bg: 'bg-emerald-50' },
        { id: 'shifts', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100' },
        { id: 'daily_presence', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100' },
        { id: 'absences', icon: Clock, color: 'text-red-500', bg: 'bg-red-50' },
        { id: 'hourly_blockages', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
        { id: 'equipment', icon: Package, color: 'text-orange-500', bg: 'bg-orange-50' },
        { id: 'permission_templates', icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-100' },
        { id: 'scheduling_constraints', icon: Shield, color: 'text-slate-600', bg: 'bg-slate-100' },
        { id: 'team_rotations', icon: ArrowsClockwise, color: 'text-blue-500', bg: 'bg-blue-50' },
        { id: 'daily_attendance_snapshots', icon: FileText, color: 'text-teal-600', bg: 'bg-teal-50' },
        { id: 'organization_settings', icon: Database, color: 'text-slate-700', bg: 'bg-slate-200' },
    ];

    const toggleTableSelection = (tableName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedTables(prev =>
            prev.includes(tableName)
                ? prev.filter(t => t !== tableName)
                : [...prev, tableName]
        );
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            size="xl"
            title={
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-lg shadow-slate-200">
                        <Database size={24} weight="duotone" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800">תצוגה מקדימה: {snapshot.name}</h2>
                        <p className="text-sm font-bold text-slate-400">
                            נוצר ב-{new Date(snapshot.created_at).toLocaleString('he-IL')} • {snapshot.created_by_name || 'המערכת'}
                        </p>
                    </div>
                </div>
            }
            footer={
                <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                        <FileText size={16} />
                        גרסה #{snapshot.id.slice(0, 8)}
                    </div>
                    <div className="flex gap-3">
                        <Button variant="ghost" onClick={onClose} className="font-bold text-slate-500">סגור</Button>
                        <Button
                            variant="primary"
                            icon={ArrowsClockwise}
                            onClick={() => onRestore(selectedTables.length > 0 ? selectedTables : undefined)}
                            className={`${selectedTables.length > 0 ? 'bg-orange-600 border-orange-600' : 'bg-blue-600 border-blue-600'} hover:opacity-90 shadow-lg transition-all`}
                        >
                            {selectedTables.length > 0
                                ? `שחזר ${selectedTables.length} טבלאות נבחרות`
                                : 'שחזר גרסה מלאה'}
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="flex flex-col h-[70vh] min-h-[500px]">
                <div className="flex-1 overflow-hidden flex flex-col">
                    {!viewingTable ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 overflow-y-auto p-1 custom-scrollbar">
                            {categories.map((cat) => {
                                const isSelected = selectedTables.includes(cat.id);
                                return (
                                    <div key={cat.id} className="relative group">
                                        <button
                                            onClick={() => setViewingTable(cat.id)}
                                            className={`w-full bg-white border ${isSelected ? 'border-orange-400 ring-2 ring-orange-100 shadow-md' : 'border-slate-200'} rounded-2xl p-6 flex flex-col items-center gap-3 hover:border-blue-400 hover:shadow-lg transition-all`}
                                        >
                                            <div className={`w-12 h-12 ${cat.bg} ${cat.color} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                                <cat.icon size={28} weight="duotone" />
                                            </div>
                                            <span className="font-black text-slate-700 text-sm italic">{getTableLabel(cat.id)}</span>

                                            <div
                                                onClick={(e) => toggleTableSelection(cat.id, e)}
                                                className={`absolute top-3 left-3 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer ${isSelected ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-slate-200 text-transparent'
                                                    }`}
                                            >
                                                <CheckCircle size={16} weight="bold" />
                                            </div>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col min-h-0">
                            {loadingData ? (
                                <div className="flex flex-col items-center justify-center py-20 flex-1">
                                    <div className="w-16 h-16 relative mb-6">
                                        <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
                                        <div
                                            className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"
                                            style={{ animationDuration: '0.8s' }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center font-black text-blue-600 text-xs">
                                            {fetchProgress}%
                                        </div>
                                    </div>
                                    <p className="text-slate-800 font-black text-lg mb-1">אוסף נתונים מהגיבוי...</p>
                                    <p className="text-slate-400 font-bold text-sm">אנא המתינו, השלמנו {fetchProgress}% מהטעינה</p>

                                    {/* Progress Bar */}
                                    <div className="w-64 h-2 bg-slate-100 rounded-full mt-6 overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 transition-all duration-300 ease-out"
                                            style={{ width: `${fetchProgress}%` }}
                                        />
                                    </div>
                                </div>
                            ) : error ? (
                                <div className="flex flex-col items-center justify-center py-20 flex-1 text-center px-10">
                                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6">
                                        <Package size={32} weight="duotone" />
                                    </div>
                                    <h3 className="text-xl font-black text-slate-800 mb-2">אופס, משהו השתבש</h3>
                                    <p className="text-slate-500 font-bold mb-6 max-w-md">לא הצלחנו לטעון את נתוני הטבלה. ייתכן שהנפח גדול מדי עבור התצוגה המקדימה.</p>
                                    <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-mono mb-8 w-full max-w-sm overflow-hidden text-ellipsis">
                                        {error}
                                    </div>
                                    <Button variant="outline" onClick={() => loadTableData(viewingTable!)}>נסה שוב</Button>
                                </div>
                            ) : (
                                <TableDataViewer
                                    tableName={viewingTable}
                                    data={tableData}
                                    onBack={() => setViewingTable(null)}
                                    peopleMap={peopleMap}
                                    teamsMap={teamsMap}
                                    rolesMap={rolesMap}
                                    tasksMap={tasksMap}
                                    equipmentMap={equipmentMap}
                                    // Pass supplementary data for reconstruction
                                    absences={absencesMap}
                                    teamRotations={rotationsMap}
                                    hourlyBlockages={blockagesMap}
                                    engineVersion={organizationsMap?.[0]?.engine_version || organizationSettingsMap?.[0]?.engine_version || 'v1_legacy'}
                                    snapshotDate={snapshot?.created_at}
                                    snapshotId={snapshot?.id}
                                />
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-4 bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-4 items-start shrink-0">
                    <Eye size={24} className="text-amber-500 shrink-0" weight="duotone" />
                    <div className="text-xs text-amber-700 leading-relaxed font-bold">
                        <p className="mb-1">מצב תצוגה מקדימה מאפשר לך לעיין בנתוני העבר מבלי לשנות את המערכת הנוכחית.</p>
                        <p>כדי להפוך נתונים אלו לפעילים, עליך ללחוץ על "שחזר גרסה זו".</p>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
