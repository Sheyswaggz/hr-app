import { Request, Response, NextFunction } from 'express';
import { AppraisalService } from '../services/appraisal.service';
import {
  CreateAppraisalCycleInput,
  UpdateAppraisalCycleInput,
  SubmitSelfAssessmentInput,
  SubmitManagerReviewInput,
  AppraisalStatus,
  AppraisalCycleStatus,
} from '../types/appraisal';

const appraisalService = new AppraisalService();

export class AppraisalController {
  /**
   * Create a new appraisal cycle
   * POST /api/appraisals/cycles
   * Authorization: HR, Manager
   */
  async createAppraisalCycle(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const cycleData: CreateAppraisalCycleInput = req.body;
      const createdBy = req.user!.id;

      const cycle = await appraisalService.createAppraisalCycle(
        cycleData,
        createdBy,
      );

      res.status(201).json({
        success: true,
        message: 'Appraisal cycle created successfully',
        data: cycle,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all appraisal cycles
   * GET /api/appraisals/cycles
   * Authorization: HR, Manager, Employee
   */
  async getAppraisalCycles(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { status, year } = req.query;

      const filters: {
        status?: AppraisalCycleStatus;
        year?: number;
      } = {};

      if (status) {
        filters.status = status as AppraisalCycleStatus;
      }

      if (year) {
        filters.year = parseInt(year as string, 10);
      }

      const cycles = await appraisalService.getAppraisalCycles(filters);

      res.status(200).json({
        success: true,
        data: cycles,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a specific appraisal cycle
   * GET /api/appraisals/cycles/:cycleId
   * Authorization: HR, Manager, Employee
   */
  async getAppraisalCycle(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { cycleId } = req.params;

      const cycle = await appraisalService.getAppraisalCycleById(
        parseInt(cycleId, 10),
      );

      if (!cycle) {
        res.status(404).json({
          success: false,
          message: 'Appraisal cycle not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: cycle,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update an appraisal cycle
   * PUT /api/appraisals/cycles/:cycleId
   * Authorization: HR
   */
  async updateAppraisalCycle(
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      const { cycleId } = req.params;
      const updateData: UpdateAppraisalCycleInput = req.body;

      const cycle = await appraisalService.updateAppraisalCycle(
        parseInt(cycleId, 10),
        updateData,
      );

      res.status(200).json({
        success: true,
        message: 'Appraisal cycle updated successfully',
        data: cycle,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Update failed',
      });
    }
  }

  /**
   * Delete an appraisal cycle
   * DELETE /api/appraisals/cycles/:cycleId
   * Authorization: HR
   */
  async deleteAppraisalCycle(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { cycleId } = req.params;

      await appraisalService.deleteAppraisalCycle(parseInt(cycleId, 10));

      res.status(200).json({
        success: true,
        message: 'Appraisal cycle deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all appraisals for a cycle
   * GET /api/appraisals/cycles/:cycleId/appraisals
   * Authorization: HR, Manager
   */
  async getAppraisalsByCycle(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { cycleId } = req.params;
      const { status, employeeId } = req.query;

      const filters: {
        status?: AppraisalStatus;
        employeeId?: number;
      } = {};

      if (status) {
        filters.status = status as AppraisalStatus;
      }

      if (employeeId) {
        filters.employeeId = parseInt(employeeId as string, 10);
      }

      const appraisals = await appraisalService.getAppraisalsByCycle(
        parseInt(cycleId, 10),
        filters,
      );

      res.status(200).json({
        success: true,
        data: appraisals,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get appraisals for an employee
   * GET /api/appraisals/employee/:employeeId
   * Authorization: HR, Manager, Employee (own only)
   */
  async getEmployeeAppraisals(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { employeeId } = req.params;
      const { cycleId, status } = req.query;

      // Authorization check: employees can only view their own appraisals
      const requestingUserId = req.user!.id;
      const requestingUserRole = req.user!.role;

      if (
        requestingUserRole === 'employee' &&
        requestingUserId !== parseInt(employeeId, 10)
      ) {
        res.status(403).json({
          success: false,
          message: 'You can only view your own appraisals',
        });
        return;
      }

      const filters: {
        cycleId?: number;
        status?: AppraisalStatus;
      } = {};

      if (cycleId) {
        filters.cycleId = parseInt(cycleId as string, 10);
      }

      if (status) {
        filters.status = status as AppraisalStatus;
      }

      const appraisals = await appraisalService.getEmployeeAppraisals(
        parseInt(employeeId, 10),
        filters,
      );

      res.status(200).json({
        success: true,
        data: appraisals,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get appraisals managed by a manager
   * GET /api/appraisals/manager/:managerId
   * Authorization: HR, Manager (own only)
   */
  async getManagerAppraisals(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { managerId } = req.params;
      const { cycleId, status } = req.query;

      // Authorization check: managers can only view appraisals they manage
      const requestingUserId = req.user!.id;
      const requestingUserRole = req.user!.role;

      if (
        requestingUserRole === 'manager' &&
        requestingUserId !== parseInt(managerId, 10)
      ) {
        res.status(403).json({
          success: false,
          message: 'You can only view appraisals you manage',
        });
        return;
      }

      const filters: {
        cycleId?: number;
        status?: AppraisalStatus;
      } = {};

      if (cycleId) {
        filters.cycleId = parseInt(cycleId as string, 10);
      }

      if (status) {
        filters.status = status as AppraisalStatus;
      }

      const appraisals = await appraisalService.getManagerAppraisals(
        parseInt(managerId, 10),
        filters,
      );

      res.status(200).json({
        success: true,
        data: appraisals,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a specific appraisal
   * GET /api/appraisals/:appraisalId
   * Authorization: HR, Manager (if managing), Employee (if own)
   */
  async getAppraisal(
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      const { appraisalId } = req.params;

      const appraisal = await appraisalService.getAppraisalById(
        parseInt(appraisalId, 10),
      );

      if (!appraisal) {
        res.status(404).json({
          success: false,
          message: 'Appraisal not found',
        });
        return;
      }

      // Authorization check
      const requestingUserId = req.user!.id;
      const requestingUserRole = req.user!.role;

      if (
        requestingUserRole === 'employee' &&
        appraisal.employee_id !== requestingUserId
      ) {
        res.status(403).json({
          success: false,
          message: 'You can only view your own appraisals',
        });
        return;
      }

      if (
        requestingUserRole === 'manager' &&
        appraisal.manager_id !== requestingUserId
      ) {
        res.status(403).json({
          success: false,
          message: 'You can only view appraisals you manage',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: appraisal,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve appraisal',
      });
    }
  }

  /**
   * Submit self-assessment
   * POST /api/appraisals/:appraisalId/self-assessment
   * Authorization: Employee (own only)
   */
  async submitSelfAssessment(
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      const { appraisalId } = req.params;
      const assessmentData: SubmitSelfAssessmentInput = req.body;
      const employeeId = req.user!.id;

      const appraisal = await appraisalService.submitSelfAssessment(
        parseInt(appraisalId, 10),
        employeeId,
        assessmentData,
      );

      res.status(200).json({
        success: true,
        message: 'Self-assessment submitted successfully',
        data: appraisal,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Submission failed',
      });
    }
  }

  /**
   * Submit manager review
   * POST /api/appraisals/:appraisalId/manager-review
   * Authorization: Manager (if managing this appraisal)
   */
  async submitManagerReview(
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      const { appraisalId } = req.params;
      const reviewData: SubmitManagerReviewInput = req.body;
      const managerId = req.user!.id;

      const appraisal = await appraisalService.submitManagerReview(
        parseInt(appraisalId, 10),
        managerId,
        reviewData,
      );

      res.status(200).json({
        success: true,
        message: 'Manager review submitted successfully',
        data: appraisal,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Submission failed',
      });
    }
  }

  /**
   * Update appraisal status
   * PATCH /api/appraisals/:appraisalId/status
   * Authorization: HR, Manager (if managing)
   */
  async updateAppraisalStatus(
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      const { appraisalId } = req.params;
      const { status } = req.body;

      if (!status) {
        res.status(400).json({
          success: false,
          message: 'Status is required',
        });
        return;
      }

      const appraisal = await appraisalService.updateAppraisalStatus(
        parseInt(appraisalId, 10),
        status as AppraisalStatus,
      );

      res.status(200).json({
        success: true,
        message: 'Appraisal status updated successfully',
        data: appraisal,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Update failed',
      });
    }
  }

  /**
   * Add goals to an appraisal
   * POST /api/appraisals/:appraisalId/goals
   * Authorization: Manager (if managing), Employee (if own and in draft)
   */
  async addGoals(
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      const { appraisalId } = req.params;
      const { goals } = req.body;

      if (!goals || !Array.isArray(goals)) {
        res.status(400).json({
          success: false,
          message: 'Goals array is required',
        });
        return;
      }

      const appraisal = await appraisalService.addGoals(
        parseInt(appraisalId, 10),
        goals,
      );

      res.status(200).json({
        success: true,
        message: 'Goals added successfully',
        data: appraisal,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add goals',
      });
    }
  }

  /**
   * Update goal progress
   * PATCH /api/appraisals/:appraisalId/goals/:goalId
   * Authorization: Employee (if own), Manager (if managing)
   */
  async updateGoalProgress(
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      const { appraisalId, goalId } = req.params;
      const { progress, notes } = req.body;

      if (progress === undefined) {
        res.status(400).json({
          success: false,
          message: 'Progress is required',
        });
        return;
      }

      const appraisal = await appraisalService.updateGoalProgress(
        parseInt(appraisalId, 10),
        parseInt(goalId, 10),
        progress,
        notes,
      );

      res.status(200).json({
        success: true,
        message: 'Goal progress updated successfully',
        data: appraisal,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to update progress',
      });
    }
  }

  /**
   * Get appraisal statistics for a cycle
   * GET /api/appraisals/cycles/:cycleId/statistics
   * Authorization: HR, Manager
   */
  async getAppraisalStatistics(
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      const { cycleId } = req.params;

      const statistics = await appraisalService.getAppraisalStatistics(
        parseInt(cycleId, 10),
      );

      res.status(200).json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve statistics',
      });
    }
  }

  /**
   * Get overdue appraisals
   * GET /api/appraisals/overdue
   * Authorization: HR, Manager
   */
  async getOverdueAppraisals(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { cycleId } = req.query;

      const filters: { cycleId?: number } = {};

      if (cycleId) {
        filters.cycleId = parseInt(cycleId as string, 10);
      }

      const appraisals = await appraisalService.getOverdueAppraisals(filters);

      res.status(200).json({
        success: true,
        data: appraisals,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send reminder for pending appraisals
   * POST /api/appraisals/:appraisalId/remind
   * Authorization: HR, Manager (if managing)
   */
  async sendReminder(
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      const { appraisalId } = req.params;

      await appraisalService.sendAppraisalReminder(parseInt(appraisalId, 10));

      res.status(200).json({
        success: true,
        message: 'Reminder sent successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to send reminder',
      });
    }
  }

  /**
   * Export appraisal data
   * GET /api/appraisals/cycles/:cycleId/export
   * Authorization: HR
   */
  async exportAppraisalData(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { cycleId } = req.params;
      const { format = 'json' } = req.query;

      const data = await appraisalService.exportAppraisalData(
        parseInt(cycleId, 10),
      );

      if (format === 'csv') {
        // Convert to CSV format
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=appraisals-cycle-${cycleId}.csv`,
        );
        // Simple CSV conversion (in production, use a proper CSV library)
        const csv = this.convertToCSV(data);
        res.status(200).send(csv);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=appraisals-cycle-${cycleId}.json`,
        );
        res.status(200).json(data);
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Helper method to convert data to CSV
   */
  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map((header) => {
        const value = row[header];
        return typeof value === 'string' ? `"${value}"` : value;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }
}