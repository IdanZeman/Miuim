console.log('🏁 [Server] Starting initialization...');
import './env.js';
console.log('✅ [Server] Environment variables loaded');
import express from 'express';
import cors from 'cors';
console.log('✅ [Server] Core modules imported');
import { authMiddleware } from './middleware/auth.js';
import { loggingMiddleware } from './middleware/loggingMiddleware.js';
import { getOrCreateProfile } from './controllers/authController.js';
import { getOrgDataBundle } from './controllers/organizationController.js';
import { getBattalionPeople, getBattalionPresenceSummary, getBattalionStats } from './controllers/battalionController.js';
import { upsertPerson, upsertTeam, upsertRole } from './controllers/personnelController.js';
import { upsertDailyPresence, reportAttendance } from './controllers/attendanceController.js';
import { execAdminRpc } from './controllers/adminController.js';
import { joinByToken, getOrgNameByToken } from './controllers/systemController.js';

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
app.get('/api/battalion/people', authMiddleware, getBattalionPeople);
app.get('/api/battalion/presence', authMiddleware, getBattalionPresenceSummary);
app.get('/api/battalion/stats', authMiddleware, getBattalionStats);

// Personnel Management
app.post('/api/personnel/person', authMiddleware, upsertPerson);
app.post('/api/personnel/team', authMiddleware, upsertTeam);
app.post('/api/personnel/role', authMiddleware, upsertRole);

// Attendance Tracking
app.post('/api/attendance/upsert', authMiddleware, upsertDailyPresence);
app.post('/api/attendance/report', authMiddleware, reportAttendance);

// Admin & Analytics
app.post('/api/admin/rpc', authMiddleware, execAdminRpc);

// System Utilities
app.post('/api/system/join', authMiddleware, joinByToken);
app.get('/api/system/org-name/:p_token', getOrgNameByToken);

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}

export default app;
