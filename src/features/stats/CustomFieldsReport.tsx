import React, { useState, useEffect } from 'react';
import { Person, CustomFieldDefinition, CustomFieldType } from '../../types';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ListChecks, Users, ChartPie, ChartBar, CaretDown, House, UserCircle, Briefcase, MagnifyingGlass as Search } from '@phosphor-icons/react';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { ExportButton } from '../../components/ui/ExportButton';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../auth/AuthContext';

interface CustomFieldsReportProps {
    people: Person[];
    teams?: any[];
    roles?: any[];
}

interface ValueGroup {
    value: any;
    displayValue: string;
    count: number;
    percentage: number;
    people: Person[];
}

interface FieldAnalysis {
    fieldKey: string;
    fieldLabel: string;
    fieldType: CustomFieldType;
    totalPeople: number;
    valueGroups: ValueGroup[];
    statistics?: {
        min?: number;
        max?: number;
        avg?: number;
        median?: number;
        uniqueCount?: number;
    };
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export const CustomFieldsReport: React.FC<CustomFieldsReportProps> = ({ people, teams = [], roles = [] }) => {
    const { organization } = useAuth();
    const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
    const [selectedFieldKey, setSelectedFieldKey] = useState<string>('');
    const [analysis, setAnalysis] = useState<FieldAnalysis | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    // Helper functions to get names
    const getTeamName = (teamId: string) => {
        if (!teamId) return 'ללא צוות';
        const team = teams.find(t => t.id === teamId);
        return team?.name || 'ללא צוות';
    };

    const getRoleName = (roleId: string) => {
        if (!roleId) return 'ללא תפקיד';
        const role = roles.find(r => r.id === roleId);
        return role?.name || 'ללא תפקיד';
    };

    const getAllRoleNames = (roleIds: string[] | undefined) => {
        if (!roleIds || roleIds.length === 0) return 'ללא תפקיד';
        return roleIds.map(id => getRoleName(id)).join(', ');
    };

    useEffect(() => {
        fetchCustomFields();
    }, [organization]);

    useEffect(() => {
        if (selectedFieldKey && customFields.length > 0) {
            analyzeField(selectedFieldKey);
        }
    }, [selectedFieldKey, people, customFields]);

    const VIRTUAL_FIELDS: CustomFieldDefinition[] = [
        { id: 'v_role', key: '_role', label: 'תפקיד', type: 'multiselect' as CustomFieldType },
        { id: 'v_team', key: '_team', label: 'צוות', type: 'select' as CustomFieldType },
    ];

    const fetchCustomFields = async () => {
        if (!organization) return;

        try {
            const { data, error } = await supabase
                .from('organization_settings')
                .select('custom_fields_schema')
                .eq('organization_id', organization.id)
                .single();

            if (error) {
                // If column doesn't exist yet, show empty state
                if (error.code === 'PGRST116' || error.message.includes('column')) {
                    console.warn('customFieldsSchema column not found - run migration: supabase/add_custom_fields_schema.sql');
                    setCustomFields(VIRTUAL_FIELDS);
                } else {
                    throw error;
                }
            } else {
                const schema = data?.custom_fields_schema || [];
                const allFields = [...VIRTUAL_FIELDS, ...schema];
                setCustomFields(allFields);

                // Auto-select first field
                if (allFields.length > 0 && !selectedFieldKey) {
                    setSelectedFieldKey(allFields[0].key);
                }
            }
        } catch (error) {
            console.error('Error fetching custom fields:', error);
            setCustomFields(VIRTUAL_FIELDS);
        } finally {
            setLoading(false);
        }
    };

    const analyzeField = (fieldKey: string) => {
        const field = customFields.find(f => f.key === fieldKey);
        if (!field) return;

        const groups = new Map<any, Person[]>();
        let numericValues: number[] = [];

        people.forEach(person => {
            let value;
            if (fieldKey === '_role') {
                value = person.roleIds || (person.roleId ? [person.roleId] : []);
            } else if (fieldKey === '_team') {
                value = person.teamId || null;
            } else {
                value = person.customFields?.[fieldKey];
            }

            if ((field.type === 'multiselect' || fieldKey === '_role') && Array.isArray(value)) {
                // Handle multiple values - person appears in multiple groups
                if (value.length === 0) {
                    const groupKey = '(ללא ערך)';
                    if (!groups.has(groupKey)) groups.set(groupKey, []);
                    groups.get(groupKey)!.push(person);
                } else {
                    value.forEach(v => {
                        const groupKey = v ?? '(ללא ערך)';
                        if (!groups.has(groupKey)) groups.set(groupKey, []);
                        groups.get(groupKey)!.push(person);
                    });
                }
            } else if (field.type === 'number' && typeof value === 'number') {
                numericValues.push(value);
                if (!groups.has(value)) groups.set(value, []);
                groups.get(value)!.push(person);
            } else {
                // Handle single value (including null/undefined)
                const groupKey = value ?? '(ללא ערך)';
                if (!groups.has(groupKey)) groups.set(groupKey, []);
                groups.get(groupKey)!.push(person);
            }
        });

        // Convert to array and calculate percentages
        const valueGroups: ValueGroup[] = Array.from(groups.entries())
            .map(([value, groupPeople]) => ({
                value,
                displayValue: formatDisplayValue(value, field.type, fieldKey),
                count: groupPeople.length,
                percentage: (groupPeople.length / people.length) * 100,
                people: groupPeople
            }))
            .sort((a, b) => b.count - a.count); // Sort by count descending

        // Calculate statistics for numeric fields
        let statistics: FieldAnalysis['statistics'] = undefined;
        if (field.type === 'number' && numericValues.length > 0) {
            const sorted = [...numericValues].sort((a, b) => a - b);
            statistics = {
                min: Math.min(...numericValues),
                max: Math.max(...numericValues),
                avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
                median: sorted[Math.floor(sorted.length / 2)]
            };
        } else if (field.type === 'text' || field.type === 'email' || field.type === 'phone') {
            statistics = {
                uniqueCount: groups.size
            };
        }

        setAnalysis({
            fieldKey: field.key,
            fieldLabel: field.label,
            fieldType: field.type,
            totalPeople: people.length,
            valueGroups,
            statistics
        });
    };

    const formatDisplayValue = (value: any, type: CustomFieldType, fieldKey?: string): string => {
        if (value === null || value === undefined || value === '' || value === '(ללא ערך)') return '(ללא ערך)';
        if (fieldKey === '_role') return getRoleName(value);
        if (fieldKey === '_team') return getTeamName(value);
        if (type === 'boolean') return value ? 'כן' : 'לא';
        if (type === 'date') {
            try {
                return new Date(value).toLocaleDateString('he-IL');
            } catch {
                return String(value);
            }
        }
        return String(value);
    };

    const toggleSection = (value: string) => {
        const newExpanded = new Set(expandedSections);
        if (newExpanded.has(value)) {
            newExpanded.delete(value);
        } else {
            newExpanded.add(value);
        }
        setExpandedSections(newExpanded);
    };

    const renderCharts = () => {
        if (!analysis) return null;

        const { fieldType, valueGroups } = analysis;

        // Prepare data for charts
        const chartData = valueGroups.map((group, index) => ({
            name: group.displayValue,
            value: group.count,
            percentage: group.percentage,
            fill: COLORS[index % COLORS.length]
        }));

        if (fieldType === 'select' || fieldType === 'multiselect' || fieldType === 'boolean') {
            return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Pie Chart with Legend */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <ChartPie size={20} className="text-emerald-600" weight="duotone" />
                            התפלגות
                        </h3>
                        <div className="flex flex-col lg:flex-row items-center gap-6">
                            {/* Pie Chart */}
                            <div className="flex-shrink-0">
                                <ResponsiveContainer width={200} height={200}>
                                    <PieChart>
                                        <Pie
                                            data={chartData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Legend */}
                            <div className="flex-1 space-y-2">
                                {chartData.map((entry, index) => (
                                    <div key={index} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-slate-50">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div
                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: entry.fill }}
                                            />
                                            <span className="text-sm font-bold text-slate-700 truncate">{entry.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-sm font-black text-slate-900">{entry.value}</span>
                                            <span className="text-xs text-slate-500">({entry.percentage.toFixed(1)}%)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Statistics Table */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <ChartBar size={20} className="text-blue-600" weight="duotone" />
                            סטטיסטיקות
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b-2 border-slate-200">
                                        <th className="text-right py-3 px-4 font-bold text-slate-700">ערך</th>
                                        <th className="text-center py-3 px-4 font-bold text-slate-700">כמות</th>
                                        <th className="text-center py-3 px-4 font-bold text-slate-700">אחוז</th>
                                        <th className="text-left py-3 px-4 font-bold text-slate-700">גרף</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chartData.map((entry, index) => (
                                        <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center gap-2 justify-end">
                                                    <span className="font-bold text-slate-900">{entry.name}</span>
                                                    <div
                                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                                        style={{ backgroundColor: entry.fill }}
                                                    />
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-center font-black text-slate-900">{entry.value}</td>
                                            <td className="py-3 px-4 text-center text-slate-600">{entry.percentage.toFixed(1)}%</td>
                                            <td className="py-3 px-4">
                                                <div className="w-full bg-slate-100 rounded-full h-6 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-300"
                                                        style={{
                                                            width: `${entry.percentage}%`,
                                                            backgroundColor: entry.fill
                                                        }}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            );
        }

        if (fieldType === 'number' && analysis.statistics) {
            return (
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">סטטיסטיקות</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                            <p className="text-xs font-bold text-emerald-600 mb-1">מינימום</p>
                            <p className="text-2xl font-black text-slate-900">{analysis.statistics.min?.toFixed(1)}</p>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                            <p className="text-xs font-bold text-blue-600 mb-1">מקסימום</p>
                            <p className="text-2xl font-black text-slate-900">{analysis.statistics.max?.toFixed(1)}</p>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                            <p className="text-xs font-bold text-amber-600 mb-1">ממוצע</p>
                            <p className="text-2xl font-black text-slate-900">{analysis.statistics.avg?.toFixed(1)}</p>
                        </div>
                        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                            <p className="text-xs font-bold text-purple-600 mb-1">חציון</p>
                            <p className="text-2xl font-black text-slate-900">{analysis.statistics.median?.toFixed(1)}</p>
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    };

    const renderRoleOverview = () => {
        if (selectedFieldKey === '_role') return null;

        const roleCounts = new Map<string, number>();
        people.forEach(p => {
            const rIds = p.roleIds || (p.roleId ? [p.roleId] : []);
            if (rIds.length === 0) {
                roleCounts.set('none', (roleCounts.get('none') || 0) + 1);
            } else {
                rIds.forEach(id => {
                    roleCounts.set(id, (roleCounts.get(id) || 0) + 1);
                });
            }
        });

        const chartData = Array.from(roleCounts.entries())
            .map(([id, count], index) => ({
                name: id === 'none' ? 'ללא תפקיד' : getRoleName(id),
                value: count,
                percentage: (count / people.length) * 100,
                fill: COLORS[index % COLORS.length]
            }))
            .sort((a, b) => b.value - a.value);

        if (chartData.length === 0) return null;

        return (
            <div className="mt-8 pt-8 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-6">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                        <Briefcase size={18} className="text-amber-600" weight="duotone" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">התפלגות תפקידים כללית</h3>
                        <p className="text-xs text-slate-500 font-bold">סקירה של כלל בעלי התפקידים במערך</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Pie Chart */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-6">
                        <div className="flex flex-col lg:flex-row items-center gap-6">
                            <div className="flex-shrink-0">
                                <ResponsiveContainer width={200} height={200}>
                                    <PieChart>
                                        <Pie
                                            data={chartData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex-1 space-y-2">
                                {chartData.slice(0, 6).map((entry, index) => (
                                    <div key={index} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-slate-50">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.fill }} />
                                            <span className="text-sm font-bold text-slate-700 truncate">{entry.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-sm font-black text-slate-900">{entry.value}</span>
                                        </div>
                                    </div>
                                ))}
                                {chartData.length > 6 && (
                                    <div className="text-xs text-slate-400 font-bold text-center pt-2 italic">
                                        + עוד {chartData.length - 6} תפקידים נוספים
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Stats table */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="text-right py-2 px-3 font-bold text-slate-500 text-xs uppercase tracking-wider">תפקיד</th>
                                        <th className="text-center py-2 px-3 font-bold text-slate-500 text-xs uppercase tracking-wider">כמות</th>
                                        <th className="text-left py-2 px-3 font-bold text-slate-500 text-xs uppercase tracking-wider">גרף</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chartData.slice(0, 5).map((entry, index) => (
                                        <tr key={index} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-2.5 px-3 text-right">
                                                <span className="font-bold text-slate-700 text-sm">{entry.name}</span>
                                            </td>
                                            <td className="py-2.5 px-3 text-center">
                                                <span className="font-black text-slate-900 text-sm">{entry.value}</span>
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full"
                                                        style={{ width: `${entry.percentage}%`, backgroundColor: entry.fill }}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderPersonCard = (person: Person) => {
        const teamName = getTeamName(person.teamId || '');
        const roleNames = getAllRoleNames(person.roleIds);

        return (
            <div
                key={person.id}
                className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-200"
            >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
                    {person.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">{person.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                            <House size={12} weight="duotone" className="text-blue-500" />
                            <span>{teamName}</span>
                        </div>
                        {person.roleIds && person.roleIds.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-slate-500 border-r border-slate-200 pr-3 mr-0">
                                <Briefcase size={12} weight="duotone" className="text-amber-500" />
                                <span className="truncate max-w-[150px]">{roleNames}</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className={`text-xs px-2 py-0.5 rounded-full font-bold ${person.isActive
                    ? 'bg-green-100 text-green-700'
                    : 'bg-slate-100 text-slate-600'
                    }`}>
                    {person.isActive ? 'פעיל' : 'לא פעיל'}
                </div>
            </div>
        );
    };

    const renderValueGroups = () => {
        if (!analysis) return null;

        const filteredGroups = analysis.valueGroups.filter(group =>
            searchTerm === '' || group.people.some(p => p.name.includes(searchTerm))
        );

        return (
            <div className="space-y-4">
                {filteredGroups.map((group, index) => {
                    const isExpanded = expandedSections.has(String(group.value));
                    const bgColor = COLORS[index % COLORS.length];

                    return (
                        <div
                            key={String(group.value)}
                            className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
                        >
                            {/* Header */}
                            <button
                                onClick={() => toggleSection(String(group.value))}
                                className="w-full p-5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div
                                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold"
                                        style={{ backgroundColor: bgColor }}
                                    >
                                        {group.count}
                                    </div>
                                    <div className="text-right">
                                        <h3 className="text-lg font-black text-slate-900">{group.displayValue}</h3>
                                        <p className="text-sm text-slate-500 font-bold">
                                            {group.count} {group.count === 1 ? 'חייל' : 'חיילים'} ({group.percentage.toFixed(1)}%)
                                        </p>
                                    </div>
                                </div>
                                <CaretDown
                                    size={20}
                                    className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                    weight="bold"
                                />
                            </button>

                            {/* Expanded Content */}
                            {isExpanded && (
                                <div className="border-t border-slate-100 p-5 bg-slate-50">
                                    {/* Role Distribution in this group (unless analyzing roles) */}
                                    {selectedFieldKey !== '_role' && (
                                        <div className="mb-6 bg-white rounded-xl border border-slate-200 p-4">
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <Briefcase size={14} weight="duotone" className="text-amber-500" />
                                                התפלגות תפקידים בקבוצה זו
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                                {(() => {
                                                    const roleCounts = new Map<string, number>();
                                                    group.people.forEach(p => {
                                                        const rIds = p.roleIds || (p.roleId ? [p.roleId] : []);
                                                        if (rIds.length === 0) {
                                                            roleCounts.set('none', (roleCounts.get('none') || 0) + 1);
                                                        } else {
                                                            rIds.forEach(id => {
                                                                roleCounts.set(id, (roleCounts.get(id) || 0) + 1);
                                                            });
                                                        }
                                                    });

                                                    return Array.from(roleCounts.entries())
                                                        .sort((a, b) => b[1] - a[1])
                                                        .map(([id, count]) => (
                                                            <div key={id} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg shadow-sm">
                                                                <span className="text-sm font-bold text-slate-700">{id === 'none' ? 'ללא תפקיד' : getRoleName(id)}</span>
                                                                <span className="bg-slate-200 text-slate-600 text-[10px] font-black px-1.5 rounded-md min-w-[20px] text-center">{count}</span>
                                                            </div>
                                                        ));
                                                })()}
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        {group.people
                                            .filter(p => searchTerm === '' || p.name.includes(searchTerm))
                                            .map(person => renderPersonCard(person))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-slate-500">טוען...</div>
            </div>
        );
    }

    if (customFields.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ListChecks size={32} className="text-slate-400" weight="duotone" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">אין שדות מותאמים אישית</h3>
                <p className="text-slate-500 mb-4">
                    כדי להשתמש בדוחות אלה, צור שדות מותאמים אישית בעמוד ניהול כוח אדם.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header & Controls */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <ListChecks size={24} className="text-emerald-600" weight="duotone" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900">דוחות שדות מותאמים</h2>
                            <p className="text-sm text-slate-500 font-bold">ניתוח נתונים לפי שדות מותאמים אישית</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Select
                            value={selectedFieldKey}
                            onChange={(val) => setSelectedFieldKey(val)}
                            options={customFields.map(field => ({
                                value: field.key,
                                label: field.label
                            }))}
                            className="min-w-[200px]"
                        />

                        {analysis && (
                            <ExportButton
                                onExport={async () => {
                                    const XLSX = await import('xlsx');

                                    // Helper functions to get names
                                    const getTeamName = (teamId: string) => {
                                        if (!teamId) return 'ללא צוות';
                                        const team = teams.find(t => t.id === teamId);
                                        return team?.name || 'ללא צוות';
                                    };

                                    const getRoleName = (roleId: string) => {
                                        if (!roleId) return 'ללא תפקיד';
                                        const role = roles.find(r => r.id === roleId);
                                        return role?.name || 'ללא תפקיד';
                                    };

                                    const getAllRoleNames = (roleIds: string[] | undefined) => {
                                        if (!roleIds || roleIds.length === 0) return 'ללא תפקיד';
                                        return roleIds.map(id => getRoleName(id)).join(', ');
                                    };

                                    // Prepare detailed data
                                    const excelData = analysis.valueGroups.flatMap(group =>
                                        group.people.map(person => ({
                                            'שם': person.name,
                                            [analysis.fieldLabel]: group.displayValue,
                                            'צוות': getTeamName(person.teamId || ''),
                                            'תפקידים': getAllRoleNames(person.roleIds),
                                            'טלפון': person.phone || '',
                                            'אימייל': person.email || '',
                                            'סטטוס': person.isActive ? 'פעיל' : 'לא פעיל'
                                        }))
                                    );

                                    // Create workbook
                                    const wb = XLSX.utils.book_new();
                                    const ws = XLSX.utils.json_to_sheet(excelData);

                                    // Set column widths
                                    ws['!cols'] = [
                                        { wch: 20 }, { wch: 15 }, { wch: 15 },
                                        { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 10 }
                                    ];

                                    // Add auto-filter
                                    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
                                    ws['!autofilter'] = { ref: XLSX.utils.encode_range(range) };

                                    XLSX.utils.book_append_sheet(wb, ws, analysis.fieldLabel.substring(0, 31));

                                    // Add summary sheet
                                    const summaryData = analysis.valueGroups.map(group => ({
                                        'ערך': group.displayValue,
                                        'כמות': group.count,
                                        'אחוז': `${group.percentage.toFixed(1)}%`
                                    }));

                                    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
                                    summaryWs['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 10 }];
                                    const summaryRange = XLSX.utils.decode_range(summaryWs['!ref'] || 'A1');
                                    summaryWs['!autofilter'] = { ref: XLSX.utils.encode_range(summaryRange) };
                                    XLSX.utils.book_append_sheet(wb, summaryWs, 'סיכום');

                                    // Generate file
                                    const date = new Date().toLocaleDateString('he-IL').replace(/\./g, '-');
                                    XLSX.writeFile(wb, `${analysis.fieldLabel}_דוח_${date}.xlsx`);
                                }}
                                iconOnly
                                size="sm"
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="space-y-6">
                {renderCharts()}
            </div>

            {/* Search */}
            {analysis && analysis.valueGroups.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-4">
                    <Input
                        placeholder="חפש חייל..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        icon={Search}
                        className="bg-slate-50"
                    />
                </div>
            )}

            {/* Value Groups */}
            {renderValueGroups()}
        </div>
    );
};
