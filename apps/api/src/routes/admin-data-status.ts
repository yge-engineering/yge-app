// Quick rollup of master-data record counts for /admin/data-health.

import { Router } from 'express';
import { prisma } from '@yge/db';

export const adminDataStatusRouter = Router();

adminDataStatusRouter.get('/counts', async (_req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const [
      customers, vendors, jobs, ies, costCodes, laborRates,
      equipRates, equipRentals, materials, employees,
      bidResults, dailyReports,
    ] = await Promise.all([
      prisma.customer.count({ where: { companyId, deletedAt: null } }),
      prisma.vendor.count({ where: { companyId, deletedAt: null } }),
      prisma.job.count({ where: { companyId, deletedAt: null } }),
      prisma.importedEstimate.count({ where: { companyId, deletedAt: null } }),
      prisma.costCode.count({ where: { companyId, deletedAt: null } }),
      prisma.laborRate.count({ where: { companyId, deletedAt: null } }),
      prisma.equipmentRate.count({ where: { companyId, deletedAt: null } }),
      prisma.equipmentRental.count({ where: { companyId, deletedAt: null } }),
      prisma.material.count({ where: { companyId, deletedAt: null } }),
      prisma.employee.count({ where: { companyId, deletedAt: null } }),
      prisma.bidResult.count({ where: { companyId, deletedAt: null } }),
      prisma.dailyReport.count({ where: { companyId, deletedAt: null } }),
    ]);
    res.json({
      counts: {
        customers, vendors, jobs, importedEstimates: ies, costCodes,
        laborRates, equipmentRates: equipRates, equipmentRentals: equipRentals,
        materials, employees, bidResults, dailyReports,
      },
    });
  } catch (err) { next(err); }
});
