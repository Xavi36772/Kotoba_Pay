import { Router, Request, Response } from 'express';
import { createTip, captureTip } from '../controllers/tip.controller';
import { verifyToken } from '../middleware/auth.middleware';
import * as paypalService from '../services/paypal.service';
import * as transactionModel from '../models/transaction.model';
import * as balanceModel from '../models/balance.model';
import { getSupabase } from '../config/supabase';

const router = Router();

router.post('/tip', verifyToken, createTip);
router.post('/tip/capture', verifyToken, captureTip);

// PayPal redirect endpoints (no auth required)
router.get('/tip/success', async (req: Request, res: Response) => {
  const orderId = (req.query.token as string) || (req.query.orderId as string);
  let captureStatus = 'unknown';
  if (orderId) {
    try {
      const capture = await paypalService.captureTipOrder(orderId);
      captureStatus = capture.status === 'COMPLETED' ? 'completed' : 'failed';
      const tx = await transactionModel.updateTransactionByOrderId(orderId, { status: captureStatus });
      if (captureStatus === 'completed' && tx?.author_id) {
        await balanceModel.addTipToBalance(tx.author_id, tx.amount);
        try {
          const supabase = getSupabase();
          const { data: donor } = await supabase.from('users').select('username').eq('id', tx.user_id).single();
          await supabase.from('notifications').insert({
            user_id: tx.author_id,
            type: 'tip_received',
            title: 'Donación recibida',
            body: `$${tx.amount.toFixed(2)} de @${donor?.username || 'Alguien'}`,
            data: { amount: tx.amount, donorUserId: tx.user_id, donorName: donor?.username },
          });
        } catch (e) { console.error('tip notification error:', e); }
      }
    } catch (e: any) {
      captureStatus = 'error: ' + (e.message || 'unknown');
      console.error('auto-capture on success redirect error:', e.message);
    }
  }
  const message = captureStatus === 'completed'
    ? '<h1>Pago completado</h1><p>Gracias por tu apoyo. Ya puedes cerrar esta ventana.</p>'
    : `<h1>Pago aprobado</h1><p>Estado: ${captureStatus}. Si el pago no se refleja, vuelve a la app y presiona "Ya pagué".</p>`;
  res.send(`<html><body>${message}</body></html>`);
});

router.get('/tip/cancel', (_req: Request, res: Response) => {
  res.send('<html><body><h1>Pago cancelado</h1><p>No se realizó ningún cargo. Puedes cerrar esta ventana.</p></body></html>');
});

export default router;
