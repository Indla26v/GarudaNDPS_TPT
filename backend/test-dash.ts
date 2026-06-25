import { getDashboardSummary } from './src/controllers/dashboard.controller';
import express from 'express';

const app = express();
app.use(express.json());

// Mock user scope
app.use((req, res, next) => {
  (req as any).user = { role: 'SP' }; // District level
  next();
});

app.get('/test-dash', getDashboardSummary);

app.listen(9999, () => {
  console.log('Test server on 9999');
});
