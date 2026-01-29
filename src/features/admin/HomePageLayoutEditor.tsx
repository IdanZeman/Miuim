import React, { useState, useEffect } from 'react';
import { HomePageConfig, HomePageWidgetId, DeviceLayout } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/ui/Button';
import { FloppyDisk as Save, Desktop, DeviceMobile as Mobile, Info, DotsSixVertical } from '@phosphor-icons/react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
    DropAnimation,
    useDroppable,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const WIDGET_LABELS: Record<HomePageWidgetId, string> = {
    attendance_reporting: 'דיווח נוכחות',
    active_shift: 'משמרת פעילה',
    war_clock: 'שעון לחימה (War Clock)',
    upcoming_schedule: 'הלו"ז הקרוב',
    leave_forecast: 'צפי יציאות',
    announcements: 'הודעות ועדכונים',
    carpool: 'טרמפים (Carpool)',
    weekly_summary: 'סיכום שבועי',
};

const DEFAULT_DESKTOP_LAYOUT: DeviceLayout = {
    main: ['attendance_reporting', 'active_shift', 'war_clock', 'upcoming_schedule', 'leave_forecast'],
    side: ['announcements', 'carpool', 'weekly_summary'],
    hidden: []
};

const DEFAULT_MOBILE_LAYOUT: DeviceLayout = {
    main: ['attendance_reporting', 'active_shift', 'war_clock', 'upcoming_schedule', 'leave_forecast', 'announcements', 'carpool', 'weekly_summary'],
    side: [], // Mobile has no side column
    hidden: []
};

// --- Sortable Item Component ---
interface SortableItemProps {
    id: HomePageWidgetId;
}

const SortableItem = ({ id }: SortableItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="flex items-center gap-3 p-3 rounded-xl border select-none cursor-grab active:cursor-grabbing transition-colors touch-none bg-white border-slate-200 text-slate-800 shadow-sm hover:border-blue-400"
        >
            <DotsSixVertical size={20} className="text-slate-400 shrink-0" />
            <span className="font-bold text-sm">{WIDGET_LABELS[id]}</span>
        </div>
    );
};

// --- Container Component ---
const LayoutContainer = ({
    id,
    items,
    title,
    subtitle,
    isMobile = false
}: {
    id: string;
    items: HomePageWidgetId[];
    title: string;
    subtitle?: string;
    isMobile?: boolean;
}) => {
    const { setNodeRef } = useDroppable({ id });

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col bg-slate-50/50 rounded-2xl border border-slate-200/60 p-4 h-full ${isMobile ? 'max-w-xs mx-auto w-full' : 'flex-1'}`}
        >
            <div className="mb-4">
                <h3 className="font-black text-slate-800 text-sm">{title}</h3>
                {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
            </div>
            <SortableContext
                id={id}
                items={items}
                strategy={verticalListSortingStrategy}
            >
                <div className="flex flex-col gap-2 min-h-[150px] flex-1">
                    {items.map((widgetId) => (
                        <SortableItem key={widgetId} id={widgetId} />
                    ))}
                    {items.length === 0 && (
                        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-400 text-xs font-bold p-4 text-center">
                            גרור לכאן רכיבים
                        </div>
                    )}
                </div>
            </SortableContext>
        </div>
    );
};


// --- Main Editor Component ---
export const HomePageLayoutEditor: React.FC<{ organizationId: string }> = ({ organizationId }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

    const [desktopLayout, setDesktopLayout] = useState<DeviceLayout>(DEFAULT_DESKTOP_LAYOUT);
    const [mobileLayout, setMobileLayout] = useState<DeviceLayout>(DEFAULT_MOBILE_LAYOUT);

    const [activeId, setActiveId] = useState<HomePageWidgetId | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        fetchSettings();
    }, [organizationId]);

    const fetchSettings = async () => {
        try {
            const { data } = await supabase
                .from('organization_settings')
                .select('home_page_config')
                .eq('organization_id', organizationId)
                .maybeSingle();

            if (data?.home_page_config) {
                const config = data.home_page_config as HomePageConfig;
                if (config.desktop) setDesktopLayout(config.desktop);
                if (config.mobile) setMobileLayout(config.mobile);
            }
        } catch (err) {
            console.error('Error fetching home settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        const config: HomePageConfig = {
            desktop: desktopLayout,
            mobile: mobileLayout
        };

        const { error } = await supabase
            .from('organization_settings')
            .update({ home_page_config: config })
            .eq('organization_id', organizationId);

        if (error) {
            showToast('שגיאה בשמירת הגדרות', 'error');
        } else {
            showToast('ההגדרות נשמרו בהצלחה', 'success');
        }
        setSaving(false);
    };

    // --- Drag Handlers ---
    const findContainer = (id: string, layout: DeviceLayout): keyof DeviceLayout | undefined => {
        if (layout.main.includes(id as HomePageWidgetId)) return 'main';
        if (layout.side.includes(id as HomePageWidgetId)) return 'side';
        if (layout.hidden.includes(id as HomePageWidgetId)) return 'hidden';
        return undefined;
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as HomePageWidgetId);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        const currentLayout = viewMode === 'desktop' ? desktopLayout : mobileLayout;
        const setLayout = viewMode === 'desktop' ? setDesktopLayout : setMobileLayout;

        if (!over) return;

        const overId = over.id;
        const activeContainer = findContainer(active.id as string, currentLayout);
        // If over a container directly (empty state) or over an item
        const overContainer = (overId === 'main' || overId === 'side' || overId === 'hidden')
            ? overId as keyof DeviceLayout
            : findContainer(overId as string, currentLayout);

        if (!activeContainer || !overContainer || activeContainer === overContainer) {
            return;
        }

        // Move item to new container during drag
        setLayout((prev) => {
            const activeItems = prev[activeContainer];
            const overItems = prev[overContainer];
            const activeIndex = activeItems.indexOf(active.id as HomePageWidgetId);
            const overIndex = (overId === 'main' || overId === 'side' || overId === 'hidden')
                ? overItems.length + 1 // Add to end if dropped on container
                : overItems.indexOf(overId as HomePageWidgetId);

            let newIndex;
            if (overId === 'main' || overId === 'side' || overId === 'hidden') {
                newIndex = overItems.length;
            } else {
                const isBelowOverItem =
                    over &&
                    active.rect.current.translated &&
                    active.rect.current.translated.top >
                    over.rect.top + over.rect.height;

                const modifier = isBelowOverItem ? 1 : 0;
                newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
            }

            return {
                ...prev,
                [activeContainer]: [
                    ...prev[activeContainer].filter((item) => item !== active.id),
                ],
                [overContainer]: [
                    ...prev[overContainer].slice(0, newIndex),
                    active.id as HomePageWidgetId,
                    ...prev[overContainer].slice(newIndex, prev[overContainer].length),
                ],
            };
        });
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        const currentLayout = viewMode === 'desktop' ? desktopLayout : mobileLayout;
        const setLayout = viewMode === 'desktop' ? setDesktopLayout : setMobileLayout;

        setActiveId(null);

        if (!over) return;

        const activeContainer = findContainer(active.id as string, currentLayout);
        const overContainer = (over.id === 'main' || over.id === 'side' || over.id === 'hidden')
            ? over.id as keyof DeviceLayout
            : findContainer(over.id as string, currentLayout);

        if (activeContainer && overContainer && activeContainer === overContainer) {
            const activeIndex = currentLayout[activeContainer].indexOf(active.id as HomePageWidgetId);
            const overIndex = currentLayout[overContainer].indexOf(over.id as HomePageWidgetId);

            if (activeIndex !== overIndex) {
                setLayout((prev) => ({
                    ...prev,
                    [activeContainer]: arrayMove(prev[activeContainer], activeIndex, overIndex),
                }));
            }
        }
    };

    const dropAnimation: DropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: '0.4',
                },
            },
        }),
    };

    if (loading) return <div className="text-slate-500 text-sm">טוען הגדרות...</div>;

    const currentLayout = viewMode === 'desktop' ? desktopLayout : mobileLayout;

    return (
        <div className="space-y-6">
            <div className="bg-blue-50/50 border border-blue-100/50 p-4 rounded-xl flex gap-3">
                <Info className="text-blue-600 shrink-0 mt-0.5" size={20} />
                <div>
                    <h4 className="font-bold text-blue-900 text-sm">עורך דף הבית</h4>
                    <p className="text-xs text-blue-700 mt-1">
                        גרור רכיבים מהבנק אל התצוגה כדי להוסיף אותם. סדר את הרכיבים כרצונך.
                        השינויים יחולו על כל המשתמשים בארגון.
                    </p>
                </div>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setViewMode('desktop')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'desktop' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <Desktop size={16} weight="bold" />
                    תצוגת מחשב
                </button>
                <button
                    onClick={() => setViewMode('mobile')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'mobile' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <Mobile size={16} weight="bold" />
                    תצוגת נייד
                </button>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Widget Bank (Hidden Items) */}
                    <div className="w-full lg:w-64 flex-shrink-0">
                        <LayoutContainer
                            id="hidden"
                            items={currentLayout.hidden}
                            title="בנק רכיבים"
                            subtitle="רכיבים מוסתרים"
                        />
                    </div>

                    {/* Active Layout Visualizer */}
                    <div className="flex-1 bg-slate-100/50 rounded-[2rem] border border-dashed border-slate-200 p-4 md:p-6 lg:p-10 flex flex-col items-center justify-start">
                        <div className={`
                            w-full transition-all duration-500 flex gap-6
                            ${viewMode === 'mobile' ? 'max-w-sm' : 'max-w-7xl'}
                        `}>
                            {/* Main Column */}
                            <LayoutContainer
                                id="main"
                                items={currentLayout.main}
                                title={viewMode === 'desktop' ? "עמודה ראשית (רחבה)" : "דף הבית (גלילה)"}
                                subtitle={viewMode === 'desktop' ? "תוכן מרכזי כמו משמרות ולועז" : undefined}
                                isMobile={viewMode === 'mobile'}

                            />

                            {/* Side Column (Desktop Only) */}
                            {viewMode === 'desktop' && (
                                <div className="w-64 flex-shrink-0 flex flex-col h-full">
                                    <LayoutContainer
                                        id="side"
                                        items={currentLayout.side}
                                        title="עמודה צדדית"
                                        subtitle="עדכונים וסיכומים"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DragOverlay dropAnimation={dropAnimation}>
                    {activeId ? <SortableItem id={activeId} /> : null}
                </DragOverlay>
            </DndContext>

            <div className="flex justify-end pt-4 border-t border-slate-100 mt-6">
                <Button
                    onClick={handleSave}
                    isLoading={saving}
                    icon={Save}
                    variant="primary"
                    className="shadow-none"
                    size="lg"
                >
                    {saving ? 'שומר...' : 'שמור תצורת דף בית'}
                </Button>
            </div>
        </div>
    );
};
