import { Router, Request, Response } from 'express';
import { createTip, captureTip } from '../controllers/tip.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

router.post('/tip', verifyToken, createTip);
router.post('/tip/capture', verifyToken, captureTip);

// PayPal redirect endpoints (no auth required)
router.get('/tip/success', (_req: Request, res: Response) => {
  res.send('<html><body><h1>Pago aprobado</h1><p>Gracias por tu apoyo. Puedes cerrar esta ventana.</p></body></html>');
});

router.get('/tip/cancel', (_req: Request, res: Response) => {
  res.send('<html><body><h1>Pago cancelado</h1><p>No se realizó ningún cargo. Puedes cerrar esta ventana.</p></body></html>');
});

export default router;
