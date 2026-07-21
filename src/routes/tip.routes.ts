import { Router } from 'express';
import { createTip, captureTip } from '../controllers/tip.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

router.post('/tip', verifyToken, createTip);
router.post('/tip/capture', verifyToken, captureTip);

export default router;
