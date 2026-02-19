console.log('🏁 [Server] Starting initialization...');
import './env.js';
console.log('✅ [Server] Environment variables loaded');
import express from 'express';
import cors from 'cors';
console.log('✅ [Server] Core modules imported');
import { authMiddleware } from './middleware/auth.js';
import { loggingMiddleware } from './middleware/loggingMiddleware.js';
import { getOrCreateProfile } from './controllers/authController.js';
import {
    getOrgDataBundle, getOrgSettings, getOrganization, searchOrganizations,
    getOrganizationsByIds, getTaskTemplates, createOrganization,
    getPendingInvite, acceptInvite, markInviteAccepted
} from './controllers/organizationController.js';
import { getBattalionPeople, getBattalionPresenceSummary, getBattalionStats, getBattalionDetails, getBattalionCompanies } from './controllers/battalionController.js';
import { upsertPerson, upsertTeam, upsertRole, getPeople, getTeams, getRoles, getAuthorizedVehicles, getGateOrganizations } from './controllers/personnelController.js';
import { upsertDailyPresence, reportAttendance, getAttendance } from './controllers/attendanceController.js';
import {
    execAdminRpc, getOrgAnalyticsSummary, getRecentSystemActivity,
    getSystemActivityChart, getGlobalStatsAggregated, getTopOrganizations,
    getSystemUsersChart, getSystemOrgsChart, getOrgTopUsers, getOrgTopPages,
    getOrgTopActions, getOrgActivityGraph, getDashboardKPIs, getNewOrgsStats,
    getTopUsers, checkSuperAdmins, getNewOrgsList, getNewUsersList,
    getActiveUsersStats, getAuditLogs
} from './controllers/adminController.js';
import { joinByToken, getOrgNameByToken } from './controllers/systemController.js';
import { getSnapshots, getSnapshotById, getSnapshotTableData, deleteSnapshotDirect } from './controllers/snapshotController.js';
import { getPolls, createPoll, updatePoll, submitResponse, getPollResults, checkUserResponse } from './controllers/pollController.js';
import { getShifts } from './controllers/shiftController.js';
import { getConstraints, getAbsences, getBlockages, getRotations, getDailyPresence } from './controllers/schedulingController.js';
import { getWarClockItems, addWarClockItem, updateWarClockItem, deleteWarClockItem } from './controllers/warClockController.js';
import { getCarpoolRides, addCarpoolRide, deleteCarpoolRide } from './controllers/carpoolController.js';
import { getLotteryHistory, addLotteryHistoryEntry } from './controllers/lotteryController.js';
import { getEquipment, getEquipmentDailyChecks } from './controllers/equipmentController.js';
import { getUserLoadStats, upsertUserLoadStats, getRotaGenerationHistory, addRotaGenerationHistory, deleteRotaGenerationHistory } from './controllers/historyController.js';


const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
    origin: true, // Allow all origins in development, configure for production
    credentials: true,
    maxAge: 86400, // Cache preflight responses for 24 hours (86400 seconds)
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(loggingMiddleware);

app.get('/', (req, res) => {
    res.json({ message: 'Shibutz Optima API Server', env: process.env.NODE_ENV });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/debug/logs', async (req, res) => {
    const { logBuffer } = await import('./utils/logger.js');
    res.json({ logs: logBuffer });
});

app.post('/api/auth/profile', authMiddleware, getOrCreateProfile);
app.get('/api/auth/profile', authMiddleware, getOrCreateProfile);
// Organization management
app.get('/api/org/details', authMiddleware, getOrganization);
app.get('/api/org/bundle', authMiddleware, getOrgDataBundle);
app.get('/api/org/settings', authMiddleware, getOrgSettings);
app.get('/api/org/search', authMiddleware, searchOrganizations);
app.get('/api/org/list', authMiddleware, getOrganizationsByIds);
app.get('/api/org/tasks', authMiddleware, getTaskTemplates);
app.post('/api/org/create', authMiddleware, createOrganization);
app.get('/api/org/invite', authMiddleware, getPendingInvite);
app.post('/api/org/invite/accept', authMiddleware, acceptInvite);
app.post('/api/org/invite/mark-accepted', authMiddleware, markInviteAccepted);
app.get('/api/battalion', authMiddleware, getBattalionDetails);
app.get('/api/battalion/companies', authMiddleware, getBattalionCompanies);
app.get('/api/battalion/people', authMiddleware, getBattalionPeople);
app.get('/api/battalion/presence', authMiddleware, getBattalionPresenceSummary);
app.get('/api/battalion/stats', authMiddleware, getBattalionStats);

// Personnel Management
app.post('/api/personnel/person', authMiddleware, upsertPerson);
app.post('/api/personnel/team', authMiddleware, upsertTeam);
app.post('/api/personnel/role', authMiddleware, upsertRole);
app.get('/api/personnel/people', authMiddleware, getPeople);
app.get('/api/personnel/teams', authMiddleware, getTeams);
app.get('/api/personnel/roles', authMiddleware, getRoles);
app.get('/api/gate/vehicles', authMiddleware, getAuthorizedVehicles);
app.get('/api/gate/organizations', authMiddleware, getGateOrganizations);

// Attendance Tracking
app.post('/api/attendance/upsert', authMiddleware, upsertDailyPresence);
app.post('/api/attendance/report', authMiddleware, reportAttendance);
app.get('/api/attendance', authMiddleware, getAttendance);

// Shifts
app.get('/api/shifts', authMiddleware, getShifts);

// Scheduling Data
app.get('/api/scheduling/constraints', authMiddleware, getConstraints);
app.get('/api/scheduling/absences', authMiddleware, getAbsences);
app.get('/api/scheduling/blockages', authMiddleware, getBlockages);
app.get('/api/scheduling/rotations', authMiddleware, getRotations);
app.get('/api/scheduling/presence', authMiddleware, getDailyPresence);

// Admin & Analytics
app.post('/api/admin/rpc', authMiddleware, execAdminRpc);
app.get('/api/admin/new-users', authMiddleware, getNewUsersList);
app.get('/api/admin/active-users', authMiddleware, getActiveUsersStats);
app.get('/api/admin/audit-logs', authMiddleware, getAuditLogs);
app.get('/api/admin/snapshots', authMiddleware, getSnapshots);
app.get('/api/admin/snapshots/details', authMiddleware, getSnapshotById);
app.get('/api/admin/snapshots/data', authMiddleware, getSnapshotTableData);
app.delete('/api/admin/snapshots', authMiddleware, deleteSnapshotDirect);

// Polls
app.get('/api/polls', authMiddleware, getPolls);
app.post('/api/polls', authMiddleware, createPoll);
app.patch('/api/polls/:id', authMiddleware, updatePoll);
app.post('/api/polls/response', authMiddleware, submitResponse);
app.get('/api/polls/:id/results', authMiddleware, getPollResults);
app.get('/api/polls/check-response', authMiddleware, checkUserResponse);


// System Utilities
app.post('/api/system/join', authMiddleware, joinByToken);
app.get('/api/system/org-name/:p_token', getOrgNameByToken);

// War Clock
app.get('/api/war-clock', authMiddleware, getWarClockItems);
app.post('/api/war-clock', authMiddleware, addWarClockItem);
app.patch('/api/war-clock/:id', authMiddleware, updateWarClockItem);
app.delete('/api/war-clock/:id', authMiddleware, deleteWarClockItem);

// Carpool
app.get('/api/carpool', authMiddleware, getCarpoolRides);
app.post('/api/carpool', authMiddleware, addCarpoolRide);
app.delete('/api/carpool/:id', authMiddleware, deleteCarpoolRide);

// Lottery
app.get('/api/lottery', authMiddleware, getLotteryHistory);
app.post('/api/lottery', authMiddleware, addLotteryHistoryEntry);

// Equipment
app.get('/api/equipment', authMiddleware, getEquipment);
app.get('/api/equipment/checks', authMiddleware, getEquipmentDailyChecks);

// History & Stats
app.get('/api/history/load-stats', authMiddleware, getUserLoadStats);
app.post('/api/history/load-stats', authMiddleware, upsertUserLoadStats);
app.get('/api/history/rota', authMiddleware, getRotaGenerationHistory);
app.post('/api/history/rota', authMiddleware, addRotaGenerationHistory);
app.delete('/api/history/rota/:id', authMiddleware, deleteRotaGenerationHistory);

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}

export default app;
