import { Request, Response, NextFunction } from 'express';
import { queryMany } from '../db/index.js';

/**
 * Employee Controller
 * 
 * Handles employee-related HTTP requests including fetching team members.
 */
export class EmployeeController {
  /**
   * Get team members for the authenticated manager
   * GET /api/employees/team
   * Authorization: Manager, HR_ADMIN
   */
  async getTeamMembers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      
      console.log('[EmployeeController] Fetching team members:', {
        userId,
        timestamp: new Date().toISOString(),
      });

      // First, get the employee ID for the authenticated user
      const managerRecord = await queryMany<{ id: string }>(
        'SELECT id FROM employees WHERE user_id = $1',
        [userId],
        { correlationId: `get_manager_${Date.now()}`, operation: 'fetch_manager' }
      );

      if (managerRecord.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Manager employee record not found',
        });
        return;
      }

      const managerId = managerRecord[0]!.id;

      // Fetch all employees reporting to this manager
      const teamMembers = await queryMany<{
        id: string;
        user_id: string;
        first_name: string;
        last_name: string;
        department: string | null;
        position: string | null;
        hire_date: Date | null;
        email: string;
      }>(
        `SELECT 
          e.id,
          e.user_id,
          e.first_name,
          e.last_name,
          e.department,
          e.position,
          e.hire_date,
          u.email
         FROM employees e
         JOIN users u ON e.user_id = u.id
         WHERE e.manager_id = $1
         ORDER BY e.last_name, e.first_name`,
        [managerId],
        { correlationId: `get_team_${Date.now()}`, operation: 'fetch_team_members' }
      );

      console.log('[EmployeeController] Team members fetched:', {
        managerId,
        count: teamMembers.length,
        timestamp: new Date().toISOString(),
      });

      res.status(200).json({
        success: true,
        data: teamMembers.map(member => ({
          id: member.id,
          userId: member.user_id,
          firstName: member.first_name,
          lastName: member.last_name,
          department: member.department,
          position: member.position,
          hireDate: member.hire_date,
          email: member.email,
        })),
      });
    } catch (error) {
      console.error('[EmployeeController] Error fetching team members:', error);
      next(error);
    }
  }
}

export const employeeController = new EmployeeController();
