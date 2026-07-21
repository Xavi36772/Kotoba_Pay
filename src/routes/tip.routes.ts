import { Router, Request, Response } from 'express';
import { createTip, captureTip } from '../controllers/tip.controller';
import { verifyToken } from '../middleware/auth.middleware';
import * as paypalService from '../services/paypal.service';
import * as transactionModel from '../models/transaction.model';
import * as balanceModel from '../models/balance.model';

const router = Router();

router.post('/tip', verifyToken, createTip);
router.post('/tip/capture', verifyToken, captureTip);

// PayPal redirect endpoints (no auth required)
router.get('/tip/success', async (req: Request, res: Response) => {
  const orderId = (req.query.token as string) || (req.query.orderId as string);
  if (orderId) {
    try {
      const capture = await paypalService.captureTipOrder(orderId);
      const status = capture.status === 'COMPLETED' ? 'completed' : 'failed';
      const tx = await transactionModel.updateTransactionByOrderId(orderId, { status });
      if (status === 'completed' && tx?.author_id) {
        await balanceModel.addTipToBalance(tx.author_id, tx.amount);
      }
    } catch (e) {
      console.error('auto-capture on success redirect error:', e);
    }
  }
  res.send('<html><body><h1>Pago aprobado</h1><p>Gracias por tu apoyo. Puedes cerrar esta ventana.</p></body></html>');
});

router.get('/tip/cancel', (_req: Request, res: Response) => {
  res.send('<html><body><h1>Pago cancelado</h1><p>No se realizó ningún cargo. Puedes cerrar esta ventana.</p></body></html>');
});

export default router;
