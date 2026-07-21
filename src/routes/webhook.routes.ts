import { Router } from 'express';
import { handleWebhook } from '../controllers/webhook.controller';

const router = Router();

router.post('/webhooks/paypal', handleWebhook);

export default router;
