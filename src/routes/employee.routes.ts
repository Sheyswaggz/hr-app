import { Router } from 'express';

import { employeeController } from '../controllers/employee.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { UserRole } from '../types/index.js';

const router = Router();

/**
 * @swagger
 * /api/employees/team:
 *   get:
 *     summary: Get team members
 *     description: Retrieves all employees reporting to the authenticated manager
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Team members retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       userId:
 *                         type: string
 *                         format: uuid
 *                       firstName:
 *                         type: string
 *                       lastName:
 *                         type: string
 *                       department:
 *                         type: string
 *                       position:
 *                         type: string
 *                       hireDate:
 *                         type: string
 *                         format: date
 *                       email:
 *                         type: string
 *                         format: email
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires Manager or HR_ADMIN role
 *       404:
 *         description: Manager employee record not found
 */
router.get(
  '/team',
  authenticate,
  authorize([UserRole.Manager, UserRole.HRAdmin]),
  (req, res, next) => {
    return employeeController.getTeamMembers(req, res, next);
  }
);

export { router as employeeRouter };
