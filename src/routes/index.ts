import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { verifyToken } from '../middleware/auth.middleware';
import { getTransactionHistory } from '../models/transaction.model';
import tipRoutes from './tip.routes';
import subscriptionRoutes from './subscription.routes';
import webhookRoutes from './webhook.routes';

const router = Router();

router.use('/payments', tipRoutes);
router.use('/payments', subscriptionRoutes);
router.use('/', webhookRoutes);

// GET /api/payments/history
router.get('/payments/history', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const history = await getTransactionHistory(req.user.id);
    res.json(history);
  } catch (err: any) {
    console.error('history error:', err.message);
    res.status(500).json({ error: 'Failed to get payment history' });
  }
});

export default router;
