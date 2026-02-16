console.log('🏁 [Server] Starting initialization...');
import './env.js';
console.log('✅ [Server] Environment variables loaded');
import express from 'express';
import cors from 'cors';
console.log('✅ [Server] Core modules imported');
import { authMiddleware } from './middleware/auth.js';
import { loggingMiddleware } from './middleware/loggingMiddleware.js';
import { getOrCreateProfile } from './controllers/authController.js';
import { getOrgDataBundle, getOrgSettings, getOrganization, searchOrganizations, getOrganizationsByIds, getTaskTemplates } from './controllers/organizationController.js';
import { getBattalionPeople, getBattalionPresenceSummary, getBattalionStats, getBattalionDetails, getBattalionCompanies } from './controllers/battalionController.js';
import { upsertPerson, upsertTeam, upsertRole, getPeople, getTeams, getRoles, getAuthorizedVehicles, getGateOrganizations } from './controllers/personnelController.js';
import { upsertDailyPresence, reportAttendance, getAttendance } from './controllers/attendanceController.js';
import { execAdminRpc, getAuditLogs } from './controllers/adminController.js';
import { joinByToken, getOrgNameByToken } from './controllers/systemController.js';
import { getSnapshots, getSnapshotById, getSnapshotTableData, deleteSnapshotDirect } from './controllers/snapshotController.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
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
app.get('/api/org/bundle', authMiddleware, getOrgDataBundle);
app.get('/api/org/settings', authMiddleware, getOrgSettings);
app.get('/api/org/details', authMiddleware, getOrganization);
app.get('/api/org/search', authMiddleware, searchOrganizations);
app.get('/api/org/list', authMiddleware, getOrganizationsByIds);
app.get('/api/org/tasks', authMiddleware, getTaskTemplates);
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

// Admin & Analytics
app.post('/api/admin/rpc', authMiddleware, execAdminRpc);
app.get('/api/admin/logs', authMiddleware, getAuditLogs);
app.get('/api/admin/snapshots', authMiddleware, getSnapshots);
app.get('/api/admin/snapshots/details', authMiddleware, getSnapshotById);
app.get('/api/admin/snapshots/data', authMiddleware, getSnapshotTableData);
app.delete('/api/admin/snapshots', authMiddleware, deleteSnapshotDirect);

// System Utilities
app.post('/api/system/join', authMiddleware, joinByToken);
app.get('/api/system/org-name/:p_token', getOrgNameByToken);

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}

export default app;
