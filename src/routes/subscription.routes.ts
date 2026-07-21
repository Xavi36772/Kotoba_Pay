import { Router } from 'express';
import { createSubscription, cancelSubscription, getSubscriptionStatus } from '../controllers/subscription.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

router.post('/subscription/create', verifyToken, createSubscription);
router.post('/subscription/cancel', verifyToken, cancelSubscription);
router.get('/subscription/:userId', verifyToken, getSubscriptionStatus);

export default router;
