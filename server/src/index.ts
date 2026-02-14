import './env.js';
import express from 'express';
import cors from 'cors';
import { authMiddleware } from './middleware/auth.js';
import { getOrCreateProfile } from './controllers/authController.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/auth/profile', authMiddleware, getOrCreateProfile);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
