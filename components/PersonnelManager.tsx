import { useAuth } from '../contexts/AuthContext'; // Added import

// ...

export const PersonnelManager: React.FC<PersonnelManagerProps> = ({
    people,
    teams,
    roles,
    onAddPerson,
    onDeletePerson,
    onUpdatePerson,
    onAddTeam,
    onUpdateTeam,
    onDeleteTeam,
    onAddRole,
    onDeleteRole,
    onUpdateRole,
    initialTab = 'people'
}) => {
    const { checkAccess } = useAuth();
    const canEdit = checkAccess('personnel', 'edit');

    const [activeTab, setActiveTab] = useState<Tab>(initialTab);
    const { showToast } = useToast();
    const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

    // ... (rest of logic)

    return (
        <div className="bg-white rounded-xl shadow-portal p-4 md:p-6 min-h-[600px]">
            {/* Tabs Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-8 pb-4 border-b border-slate-100 gap-4">
                <div className="flex p-1 bg-slate-100 rounded-full w-full md:w-auto">
                    <button onClick={() => {
                        if (teams.length === 0) {
                            showToast('יש להגדיר צוותים לפני צפייה בחיילים', 'error');
                            return;
                        }
                        setActiveTab('people'); closeForm();
                    }} className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-full text-xs md:text-sm font-bold transition-all ${activeTab === 'people' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>חיילים</button>
                    <button onClick={() => { setActiveTab('teams'); closeForm(); }} className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-full text-xs md:text-sm font-bold transition-all ${activeTab === 'teams' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>צוותים</button>
                    <button onClick={() => { setActiveTab('roles'); closeForm(); }} className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-full text-xs md:text-sm font-bold transition-all ${activeTab === 'roles' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>תפקידים</button>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    {activeTab === 'people' && canEdit && (
                        /* Import Button */
                        <button onClick={() => setIsImportWizardOpen(true)} className="flex-1 md:flex-none bg-green-100 text-green-800 hover:bg-green-200 px-4 md:px-5 py-2 md:py-2.5 rounded-full font-bold shadow-sm text-sm flex items-center justify-center gap-2 transition-colors">
                            ייבוא <FileSpreadsheet size={18} />
                        </button>
                    )}
                    {canEdit && (
                        <button onClick={() => {
                            if (activeTab === 'people' && teams.length === 0) {
                                showToast('יש להגדיר צוותים לפני הוספת חיילים', 'error');
                                setActiveTab('teams');
                                return;
                            }
                            setIsAdding(true); setEditingTeamId(null); setEditingPersonId(null); setEditingRoleId(null); setNewItemName(''); setNewName(''); setNewEmail('');
                        }} className="flex-1 md:flex-none bg-idf-yellow text-slate-900 hover:bg-idf-yellow-hover px-4 md:px-5 py-2 md:py-2.5 rounded-full font-bold shadow-sm text-sm flex items-center justify-center gap-2">
                            הוסף חדש <Plus size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Content Lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {activeTab === 'people' && (
                    <div className="col-span-full space-y-6">
                        <div className="relative max-w-md mx-auto mb-6">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="חפש לוחם..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-4 pr-10 py-2 rounded-full border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-idf-green focus:border-transparent"
                            />
                        </div>

                        {teams.concat([{ id: 'no-team', name: 'ללא צוות', color: 'border-slate-300' } as any]).map(team => {
                            const teamMembers = people.filter(p => (team.id === 'no-team' ? !p.teamId : p.teamId === team.id))
                                .filter(p => p.name.includes(searchTerm));
                            if (teamMembers.length === 0) return null;
                            const isCollapsed = collapsedTeams.has(team.id);

                            return (
                                <div key={team.id} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                    <div
                                        className="p-3 md:p-4 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => toggleTeamCollapse(team.id)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1 h-6 rounded-full ${team.color?.replace('border-', 'bg-') || 'bg-slate-300'}`}></div>
                                            <h3 className="font-bold text-slate-800 text-base md:text-lg">{team.name}</h3>
                                            <span className="bg-white px-2 py-0.5 rounded-full text-xs font-bold text-slate-500 border border-slate-200">
                                                {teamMembers.length}
                                            </span>
                                        </div>
                                        <button className="text-slate-400">
                                            {isCollapsed ? <ChevronLeft size={20} /> : <ChevronDown size={20} />}
                                        </button>
                                    </div>

                                    {!isCollapsed && (
                                        <div className="p-3 md:p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-slate-200">
                                            {teamMembers.map(person => (
                                                <div key={person.id} className="bg-white border border-slate-100 rounded-xl p-3 md:p-4 hover:shadow-md transition-all group">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                                            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm flex-shrink-0 ${person.color}`}>{getPersonInitials(person.name)}</div>
                                                            <div className="min-w-0 flex-1">
                                                                <h4 className="font-bold text-sm md:text-base text-slate-800 truncate">{person.name}</h4>
                                                                <span className="text-xs text-slate-500 truncate block">{person.email || 'אין אימייל'}</span>
                                                            </div>
                                                        </div>
                                                        {canEdit && (
                                                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                                <button onClick={() => handleEditPersonClick(person)} className="text-slate-400 hover:text-blue-500 p-1 md:p-1.5 hover:bg-blue-50 rounded-full"><Pencil size={14} /></button>
                                                                <button onClick={() => onDeletePerson(person.id)} className="text-slate-300 hover:text-red-500 p-1 md:p-1.5 hover:bg-red-50 rounded-full"><Trash2 size={14} /></button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="mt-2 md:mt-3 flex flex-wrap gap-1">
                                                        {person.roleIds.map(rid => {
                                                            const r = roles.find(role => role.id === rid);
                                                            return r ? <span key={rid} className="text-[10px] bg-slate-50 text-slate-600 px-2 py-0.5 rounded border border-slate-100">{r.name}</span> : null;
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {activeTab === 'teams' && teams.map(team => (
                    <div key={team.id} className={`bg-white border-l-4 rounded-xl p-4 md:p-6 flex justify-between items-center group hover:shadow-md transition-all ${team.color || 'border-slate-500'}`}>
                        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                            <div className="bg-slate-100 p-2 md:p-3 rounded-full text-slate-600 flex-shrink-0"><Users size={18} /></div>
                            <h4 className="font-bold text-base md:text-lg text-slate-800 truncate">{team.name}</h4>
                        </div>
                        {canEdit && (
                            <div className="flex items-center gap-1 md:gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                <button onClick={() => handleEditTeamClick(team)} className="text-slate-400 hover:text-blue-500 p-1 md:p-1.5 hover:bg-blue-50 rounded-full"><Pencil size={16} /></button>
                                <button onClick={() => onDeleteTeam(team.id)} className="text-slate-400 hover:text-red-500 p-1 md:p-1.5 hover:bg-red-50 rounded-full"><Trash2 size={16} /></button>
                            </div>
                        )}
                    </div>
                ))}

                {activeTab === 'roles' && roles.map(role => {
                    const Icon = role.icon && ROLE_ICONS[role.icon] ? ROLE_ICONS[role.icon] : Shield;
                    return (
                        <div key={role.id} className="bg-white border border-idf-card-border rounded-xl p-3 md:p-4 flex justify-between items-center group hover:border-purple-300 transition-colors">
                            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                <div className={`p-2 rounded-lg flex-shrink-0 ${role.color || 'bg-slate-100 text-slate-600'}`}>
                                    <Icon size={16} />
                                </div>
                                <h4 className="font-bold text-sm md:text-base text-slate-800 truncate">{role.name}</h4>
                            </div>
                            {canEdit && (
                                <div className="flex items-center gap-1 md:gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <button onClick={() => handleEditRoleClick(role)} className="text-slate-400 hover:text-blue-500 p-1 md:p-1.5 hover:bg-blue-50 rounded-full"><Pencil size={14} /></button>
                                    <button onClick={() => onDeleteRole(role.id)} className="text-slate-300 hover:text-red-500 p-1 md:p-1.5 hover:bg-red-50 rounded-full"><Trash2 size={14} /></button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={closeForm}
                title={getModalTitle()}
                size="md"
            >
                {renderModalContent()}
            </Modal>

            <ExcelImportWizard
                isOpen={isImportWizardOpen}
                onClose={() => setIsImportWizardOpen(false)}
                onImport={handleBulkImport}
                teams={teams}
                roles={roles}
                onAddTeam={onAddTeam}
                onAddRole={onAddRole}
            />
        </div>
    );
};
