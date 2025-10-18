import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import eventsRoutes from './routes/events';
import analysisJobsRoutes from './routes/analysisJobs';
import agentActionsRoutes from './routes/agentActions';
import smartAnalysisRoutes from './routes/smartAnalysis';
import smartAnalysisJobsRoutes from './routes/smartAnalysisJobs';
import usersRoutes from './routes/users';
import escalationsRoutes from './routes/escalations';
import blocklistRoutes from './routes/blocklist';
import { errorHandler, notFoundHandler } from './middleware/error';
import pool from './db/connection';

dotenv.config();

const app: Application = express();

const corsOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'];

// Handle CORS preflight requests
app.options('*', cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Strip /prod prefix from paths (for API Gateway stage)
app.use((req, res, next) => {
  if (req.path.startsWith('/prod/')) {
    req.url = req.url.replace('/prod', '');
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'soc-lite-backend'
  });
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      timestamp: new Date().toISOString()
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/analysis-jobs', analysisJobsRoutes);
app.use('/api/agent-actions', agentActionsRoutes);
app.use('/api/smart-analysis', smartAnalysisRoutes);
app.use('/api/smart-analysis-jobs', smartAnalysisJobsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/escalations', escalationsRoutes);
app.use('/api/blocklist', blocklistRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
