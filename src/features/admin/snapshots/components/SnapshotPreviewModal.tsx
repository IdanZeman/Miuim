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
    onRestore: () => void;
}

export const SnapshotPreviewModal: React.FC<SnapshotPreviewModalProps> = ({ snapshot, onClose, onRestore }) => {
    const [viewingTable, setViewingTable] = useState<string | null>(null);
    const [tableData, setTableData] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState(false);

    const [peopleMap, setPeopleMap] = useState<Record<string, any>>({});
    const [teamsMap, setTeamsMap] = useState<Record<string, any>>({});
    const [rolesMap, setRolesMap] = useState<Record<string, any>>({});
    const [tasksMap, setTasksMap] = useState<Record<string, any>>({});
    const [equipmentMap, setEquipmentMap] = useState<Record<string, any>>({});

    // New maps for advanced attendance calc
    const [absencesMap, setAbsencesMap] = useState<any[]>([]);
    const [rotationsMap, setRotationsMap] = useState<any[]>([]);
    const [blockagesMap, setBlockagesMap] = useState<any[]>([]);

    useEffect(() => {
        if (viewingTable) {
            loadTableData(viewingTable);
        }
    }, [viewingTable]);

    const loadTableData = async (tableName: string) => {
        try {
            setLoadingData(true);
            const data = await snapshotService.fetchSnapshotTableData(snapshot.id, tableName);
            setTableData(data);

            // Parallel fetch for dependencies
            const promises: Promise<void>[] = [];

            // Helper to fetch and set if empty
            const fetchIfMissing = async (
                mapState: any,
                tableKey: string,
                setter: (d: any) => void,
                transformToMap: boolean = false
            ) => {
                const isEmpty = Array.isArray(mapState) ? mapState.length === 0 : Object.keys(mapState).length === 0;
                if (isEmpty) {
                    try {
                        const res = await snapshotService.fetchSnapshotTableData(snapshot.id, tableKey);
                        if (transformToMap) {
                            const map: Record<string, any> = {};
                            res.forEach((item: any) => map[item.id] = item);
                            setter(map);
                        } else {
                            setter(res);
                        }
                    } catch (e) {
                        console.warn(`Failed to load dependency ${tableKey}`, e);
                    }
                }
            };

            // Define dependencies based on table
            if (['shifts', 'absences', 'daily_presence', 'unified_presence', 'equipment', 'equipment_daily_checks'].includes(tableName)) {
                promises.push(fetchIfMissing(peopleMap, 'people', setPeopleMap, true));
            }

            if (tableName === 'daily_presence' || tableName === 'unified_presence') {
                promises.push(fetchIfMissing(teamsMap, 'teams', setTeamsMap, true));
                promises.push(fetchIfMissing(absencesMap, 'absences', setAbsencesMap, false));
                promises.push(fetchIfMissing(rotationsMap, 'team_rotations', setRotationsMap, false));
                promises.push(fetchIfMissing(blockagesMap, 'hourly_blockages', setBlockagesMap, false));
            }

            if (tableName === 'people' || tableName === 'shifts') {
                promises.push(fetchIfMissing(teamsMap, 'teams', setTeamsMap, true));
                promises.push(fetchIfMissing(rolesMap, 'roles', setRolesMap, true));
            }

            if (tableName === 'shifts') {
                promises.push(fetchIfMissing(tasksMap, 'task_templates', setTasksMap, true));
            }

            if (tableName === 'equipment_daily_checks') {
                promises.push(fetchIfMissing(equipmentMap, 'equipment', setEquipmentMap, true));
            }

            await Promise.all(promises);

        } catch (error) {
            console.error('Error loading table data:', error);
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
        { id: 'equipment', icon: Package, color: 'text-orange-500', bg: 'bg-orange-50' },
    ];

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
                            onClick={onRestore}
                            className="bg-orange-600 border-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-100"
                        >
                            שחזר גרסה זו
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="flex flex-col h-[70vh] min-h-[500px]">
                <div className="flex-1 overflow-hidden flex flex-col">
                    {!viewingTable ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 overflow-y-auto p-1 custom-scrollbar">
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setViewingTable(cat.id)}
                                    className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col items-center gap-3 hover:border-blue-400 hover:shadow-lg transition-all group"
                                >
                                    <div className={`w-12 h-12 ${cat.bg} ${cat.color} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                        <cat.icon size={28} weight="duotone" />
                                    </div>
                                    <span className="font-black text-slate-700 text-sm">{getTableLabel(cat.id)}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col min-h-0">
                            {loadingData ? (
                                <div className="flex flex-col items-center justify-center py-20 animate-pulse flex-1">
                                    <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin mb-4" />
                                    <p className="text-slate-400 font-bold">טוען נתונים...</p>
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
