import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as paymentController from '../controllers/payment.controller.js';

const router = Router();

/**
 * Payment API Routes (Phase 11, Task 11.3)
 *
 * All initiation routes require authentication and strictly 'customer' role.
 * CSRF protection is enforced globally via csrfProtect in app.js.
 *
 * POST /api/v1/payments/initiate — Initiate plan purchase checkout
 */
router.post(
  '/initiate',
  authenticate,
  authorize('customer'),
  paymentController.initiatePayment
);

/**
 * Payment Webhook Route (Phase 11, Task 11.4)
 *
 * Server-to-server notification endpoint.
 * Authenticated via raw-body cryptographic signature verification (zero cookies).
 *
 * POST /api/v1/payments/webhook
 */
router.post('/webhook', paymentController.handlePaymentWebhook);

export default router;

