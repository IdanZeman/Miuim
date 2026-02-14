import './env.js';
import express from 'express';
import cors from 'cors';
import { authMiddleware } from './middleware/auth.js';
import { loggingMiddleware } from './middleware/loggingMiddleware.js';
import { getOrCreateProfile } from './controllers/authController.js';
import { getOrgDataBundle } from './controllers/organizationController.js';
import { getBattalionPeople, getBattalionPresenceSummary, getBattalionStats } from './controllers/battalionController.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(loggingMiddleware);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/auth/profile', authMiddleware, getOrCreateProfile);
app.get('/api/org/bundle', authMiddleware, getOrgDataBundle);
app.get('/api/battalion/people', authMiddleware, getBattalionPeople);
app.get('/api/battalion/presence', authMiddleware, getBattalionPresenceSummary);
app.get('/api/battalion/stats', authMiddleware, getBattalionStats);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
