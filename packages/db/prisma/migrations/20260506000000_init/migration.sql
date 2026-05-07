-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'OFFICE', 'FOREMAN', 'CREW', 'EMPLOYEE_SELF_SERVICE', 'EXTERNAL_OWNER', 'EXTERNAL_SUB', 'EXTERNAL_BOND');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('PUBLIC_AGENCY', 'PRIVATE', 'UTILITY', 'OTHER');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('BIDDING', 'AWARDED', 'ACTIVE', 'ON_HOLD', 'CLOSED', 'LOST');

-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('PW', 'DB', 'IBEW', 'PRIVATE');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'AWARDED', 'LOST', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "CostLineCategory" AS ENUM ('LABOR', 'EQUIPMENT_OWNED', 'EQUIPMENT_RENTAL', 'MATERIAL', 'SUBCONTRACT', 'OTHER');

-- CreateEnum
CREATE TYPE "EquipmentOwnership" AS ENUM ('OWNED', 'RENTED');

-- CreateEnum
CREATE TYPE "InsuranceKind" AS ENUM ('GENERAL_LIABILITY', 'AUTO', 'WORKERS_COMP', 'POLLUTION', 'UMBRELLA', 'PROFESSIONAL');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "phone" TEXT,
    "cslb" TEXT,
    "dir" TEXT,
    "dot" TEXT,
    "naics" TEXT[],
    "psc" TEXT[],
    "domain" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL,
    "supabaseUid" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "hireDate" TIMESTAMP(3) NOT NULL,
    "terminationDate" TIMESTAMP(3),
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "classification" TEXT NOT NULL,
    "homeCounty" TEXT,
    "gustoEmployeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_certifications" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "number" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contractNum" TEXT,
    "county" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'BIDDING',
    "rateType" "RateType" NOT NULL DEFAULT 'PW',
    "estStart" TIMESTAMP(3),
    "estEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "bondRequired" BOOLEAN NOT NULL DEFAULT false,
    "retentionPct" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "oppAmountCents" BIGINT NOT NULL DEFAULT 0,
    "oppPercent" DECIMAL(5,4) NOT NULL DEFAULT 0.20,
    "submittedAt" TIMESTAMP(3),
    "awardedAt" TIMESTAMP(3),
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiPromptVer" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bid_items" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "itemNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bid_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_lines" (
    "id" TEXT NOT NULL,
    "bidItemId" TEXT NOT NULL,
    "category" "CostLineCategory" NOT NULL,
    "costCodeId" TEXT,
    "laborRateId" TEXT,
    "equipmentRateId" TEXT,
    "equipmentRentalId" TEXT,
    "materialId" TEXT,
    "subcontractorId" TEXT,
    "literalDescription" TEXT,
    "literalUnitCost" INTEGER,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "otMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_codes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "cost_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_rates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "area" INTEGER,
    "burdenPct" DECIMAL(5,4) NOT NULL,
    "baseCentsPrivate" INTEGER NOT NULL,
    "baseCentsPW" INTEGER NOT NULL,
    "baseCentsDB" INTEGER NOT NULL,
    "baseCentsIBEW" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "labor_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_rates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hourlyCents" INTEGER NOT NULL,
    "ownerModel" TEXT,
    "serialNum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "equipment_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_rentals" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hourlyCents" INTEGER,
    "dailyCents" INTEGER,
    "weeklyCents" INTEGER,
    "monthlyCents" INTEGER,
    "vendor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "equipment_rentals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitCostCents" INTEGER NOT NULL,
    "vendor" TEXT,
    "lastQuotedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcontractors" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trade" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "cslb" TEXT,
    "dir" TEXT,
    "insuranceExpiresAt" TIMESTAMP(3),
    "w9OnFile" BOOLEAN NOT NULL DEFAULT false,
    "preQualified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "subcontractors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonding_profiles" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "agencyName" TEXT NOT NULL,
    "agentPhone" TEXT,
    "agentEmail" TEXT,
    "singleJobCapCents" BIGINT NOT NULL,
    "aggregateCapCents" BIGINT NOT NULL,
    "rate" DECIMAL(6,4) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonding_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_policies" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "InsuranceKind" NOT NULL,
    "carrier" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "limitCents" BIGINT NOT NULL,
    "deductibleCents" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3) NOT NULL,
    "certFileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "officers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "officers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bid_results" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT,
    "bidOpenedAt" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "bid_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bid_tabs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "bid_tabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_reports" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "reportDate" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_orders" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "change_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pcos" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pcos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_cards" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "time_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certified_payrolls" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "weekEnding" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "certified_payrolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ar_invoices" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT,
    "status" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ar_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ap_invoices" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vendorId" TEXT,
    "status" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ap_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ar_payments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ar_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ap_payments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ap_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_recs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "bank_recs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chart_accounts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "chart_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lien_waivers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "lien_waivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submittals" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "submittals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfis" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "rfis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatches" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT,
    "scheduledFor" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "folderId" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folders" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "toolbox_talks" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "toolbox_talks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT,
    "occurredAt" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weather_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "recordedAt" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "weather_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swppp_inspections" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "inspectedAt" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "swppp_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "punch_items" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "punch_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_profiles" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdf_form_mappings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "formCode" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pdf_form_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_users" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "portal_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imported_estimates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "imported_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ptoe_drafts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ptoe_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dir_rates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "craft" TEXT NOT NULL,
    "effectiveOn" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "dir_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dir_rate_sync_runs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dir_rate_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credentials" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_requests" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webauthn_credentials" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "startAt" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_share_tokens" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_share_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "microsoft_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "microsoft_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sso_handoffs" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sso_handoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ptoe_feedback" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "draftId" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ptoe_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mileage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "tripDate" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "mileage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_holds" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "liftedAt" TIMESTAMP(3),

    CONSTRAINT "legal_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "records_retention_purges" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "scheduledFor" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "records_retention_purges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signatures" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tools" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT,
    "expiresOn" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_supabaseUid_key" ON "users"("supabaseUid");

-- CreateIndex
CREATE INDEX "users_companyId_idx" ON "users"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE INDEX "employees_companyId_idx" ON "employees"("companyId");

-- CreateIndex
CREATE INDEX "employee_certifications_employeeId_idx" ON "employee_certifications"("employeeId");

-- CreateIndex
CREATE INDEX "employee_certifications_expiresAt_idx" ON "employee_certifications"("expiresAt");

-- CreateIndex
CREATE INDEX "customers_companyId_idx" ON "customers"("companyId");

-- CreateIndex
CREATE INDEX "jobs_companyId_idx" ON "jobs"("companyId");

-- CreateIndex
CREATE INDEX "jobs_customerId_idx" ON "jobs"("customerId");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_companyId_jobNumber_key" ON "jobs"("companyId", "jobNumber");

-- CreateIndex
CREATE INDEX "estimates_companyId_idx" ON "estimates"("companyId");

-- CreateIndex
CREATE INDEX "estimates_jobId_idx" ON "estimates"("jobId");

-- CreateIndex
CREATE INDEX "bid_items_estimateId_idx" ON "bid_items"("estimateId");

-- CreateIndex
CREATE INDEX "cost_lines_bidItemId_idx" ON "cost_lines"("bidItemId");

-- CreateIndex
CREATE INDEX "cost_lines_costCodeId_idx" ON "cost_lines"("costCodeId");

-- CreateIndex
CREATE INDEX "cost_codes_companyId_idx" ON "cost_codes"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "cost_codes_companyId_code_key" ON "cost_codes"("companyId", "code");

-- CreateIndex
CREATE INDEX "labor_rates_companyId_idx" ON "labor_rates"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "labor_rates_companyId_code_effectiveFrom_key" ON "labor_rates"("companyId", "code", "effectiveFrom");

-- CreateIndex
CREATE INDEX "equipment_rates_companyId_idx" ON "equipment_rates"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_rates_companyId_code_key" ON "equipment_rates"("companyId", "code");

-- CreateIndex
CREATE INDEX "equipment_rentals_companyId_idx" ON "equipment_rentals"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_rentals_companyId_code_key" ON "equipment_rentals"("companyId", "code");

-- CreateIndex
CREATE INDEX "materials_companyId_idx" ON "materials"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "materials_companyId_code_key" ON "materials"("companyId", "code");

-- CreateIndex
CREATE INDEX "subcontractors_companyId_idx" ON "subcontractors"("companyId");

-- CreateIndex
CREATE INDEX "bonding_profiles_companyId_idx" ON "bonding_profiles"("companyId");

-- CreateIndex
CREATE INDEX "insurance_policies_companyId_idx" ON "insurance_policies"("companyId");

-- CreateIndex
CREATE INDEX "insurance_policies_effectiveTo_idx" ON "insurance_policies"("effectiveTo");

-- CreateIndex
CREATE INDEX "officers_companyId_idx" ON "officers"("companyId");

-- CreateIndex
CREATE INDEX "audit_events_companyId_createdAt_idx" ON "audit_events"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "vendors_companyId_deletedAt_idx" ON "vendors"("companyId", "deletedAt");

-- CreateIndex
CREATE INDEX "bid_results_companyId_bidOpenedAt_idx" ON "bid_results"("companyId", "bidOpenedAt");

-- CreateIndex
CREATE INDEX "bid_results_companyId_jobId_idx" ON "bid_results"("companyId", "jobId");

-- CreateIndex
CREATE INDEX "bid_tabs_companyId_jobId_idx" ON "bid_tabs"("companyId", "jobId");

-- CreateIndex
CREATE INDEX "daily_reports_companyId_jobId_reportDate_idx" ON "daily_reports"("companyId", "jobId", "reportDate");

-- CreateIndex
CREATE INDEX "change_orders_companyId_jobId_idx" ON "change_orders"("companyId", "jobId");

-- CreateIndex
CREATE INDEX "pcos_companyId_jobId_idx" ON "pcos"("companyId", "jobId");

-- CreateIndex
CREATE INDEX "time_cards_companyId_weekStart_idx" ON "time_cards"("companyId", "weekStart");

-- CreateIndex
CREATE INDEX "time_cards_companyId_employeeId_idx" ON "time_cards"("companyId", "employeeId");

-- CreateIndex
CREATE INDEX "certified_payrolls_companyId_jobId_weekEnding_idx" ON "certified_payrolls"("companyId", "jobId", "weekEnding");

-- CreateIndex
CREATE INDEX "ar_invoices_companyId_status_idx" ON "ar_invoices"("companyId", "status");

-- CreateIndex
CREATE INDEX "ar_invoices_companyId_jobId_idx" ON "ar_invoices"("companyId", "jobId");

-- CreateIndex
CREATE INDEX "ap_invoices_companyId_status_idx" ON "ap_invoices"("companyId", "status");

-- CreateIndex
CREATE INDEX "ap_invoices_companyId_vendorId_idx" ON "ap_invoices"("companyId", "vendorId");

-- CreateIndex
CREATE INDEX "ar_payments_companyId_idx" ON "ar_payments"("companyId");

-- CreateIndex
CREATE INDEX "ap_payments_companyId_idx" ON "ap_payments"("companyId");

-- CreateIndex
CREATE INDEX "bank_recs_companyId_accountId_periodEnd_idx" ON "bank_recs"("companyId", "accountId", "periodEnd");

-- CreateIndex
CREATE INDEX "journal_entries_companyId_idx" ON "journal_entries"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "chart_accounts_companyId_number_key" ON "chart_accounts"("companyId", "number");

-- CreateIndex
CREATE INDEX "expenses_companyId_idx" ON "expenses"("companyId");

-- CreateIndex
CREATE INDEX "lien_waivers_companyId_jobId_idx" ON "lien_waivers"("companyId", "jobId");

-- CreateIndex
CREATE INDEX "submittals_companyId_jobId_idx" ON "submittals"("companyId", "jobId");

-- CreateIndex
CREATE INDEX "rfis_companyId_jobId_idx" ON "rfis"("companyId", "jobId");

-- CreateIndex
CREATE INDEX "dispatches_companyId_scheduledFor_idx" ON "dispatches"("companyId", "scheduledFor");

-- CreateIndex
CREATE INDEX "documents_companyId_folderId_idx" ON "documents"("companyId", "folderId");

-- CreateIndex
CREATE INDEX "folders_companyId_parentId_idx" ON "folders"("companyId", "parentId");

-- CreateIndex
CREATE INDEX "photos_companyId_jobId_idx" ON "photos"("companyId", "jobId");

-- CreateIndex
CREATE INDEX "toolbox_talks_companyId_idx" ON "toolbox_talks"("companyId");

-- CreateIndex
CREATE INDEX "incidents_companyId_occurredAt_idx" ON "incidents"("companyId", "occurredAt");

-- CreateIndex
CREATE INDEX "weather_logs_companyId_jobId_recordedAt_idx" ON "weather_logs"("companyId", "jobId", "recordedAt");

-- CreateIndex
CREATE INDEX "swppp_inspections_companyId_jobId_inspectedAt_idx" ON "swppp_inspections"("companyId", "jobId", "inspectedAt");

-- CreateIndex
CREATE INDEX "punch_items_companyId_jobId_status_idx" ON "punch_items"("companyId", "jobId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "master_profiles_companyId_key" ON "master_profiles"("companyId");

-- CreateIndex
CREATE INDEX "pdf_form_mappings_companyId_agency_idx" ON "pdf_form_mappings"("companyId", "agency");

-- CreateIndex
CREATE UNIQUE INDEX "portal_users_companyId_email_key" ON "portal_users"("companyId", "email");

-- CreateIndex
CREATE INDEX "imported_estimates_companyId_jobNumber_idx" ON "imported_estimates"("companyId", "jobNumber");

-- CreateIndex
CREATE INDEX "ptoe_drafts_companyId_createdAt_idx" ON "ptoe_drafts"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "ptoe_drafts_companyId_jobId_idx" ON "ptoe_drafts"("companyId", "jobId");

-- CreateIndex
CREATE INDEX "dir_rates_companyId_craft_effectiveOn_idx" ON "dir_rates"("companyId", "craft", "effectiveOn");

-- CreateIndex
CREATE INDEX "dir_rate_sync_runs_companyId_startedAt_idx" ON "dir_rate_sync_runs"("companyId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_companyId_email_key" ON "credentials"("companyId", "email");

-- CreateIndex
CREATE INDEX "otp_requests_email_expiresAt_idx" ON "otp_requests"("email", "expiresAt");

-- CreateIndex
CREATE INDEX "webauthn_credentials_email_idx" ON "webauthn_credentials"("email");

-- CreateIndex
CREATE INDEX "calendar_events_companyId_startAt_idx" ON "calendar_events"("companyId", "startAt");

-- CreateIndex
CREATE INDEX "calendar_share_tokens_companyId_expiresAt_idx" ON "calendar_share_tokens"("companyId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "microsoft_tokens_email_key" ON "microsoft_tokens"("email");

-- CreateIndex
CREATE INDEX "sso_handoffs_expiresAt_idx" ON "sso_handoffs"("expiresAt");

-- CreateIndex
CREATE INDEX "ptoe_feedback_companyId_createdAt_idx" ON "ptoe_feedback"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "mileage_companyId_employeeId_tripDate_idx" ON "mileage"("companyId", "employeeId", "tripDate");

-- CreateIndex
CREATE INDEX "legal_holds_companyId_liftedAt_idx" ON "legal_holds"("companyId", "liftedAt");

-- CreateIndex
CREATE INDEX "records_retention_purges_companyId_scheduledFor_idx" ON "records_retention_purges"("companyId", "scheduledFor");

-- CreateIndex
CREATE INDEX "signatures_companyId_createdAt_idx" ON "signatures"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "tools_companyId_status_idx" ON "tools"("companyId", "status");

-- CreateIndex
CREATE INDEX "certificates_companyId_expiresOn_idx" ON "certificates"("companyId", "expiresOn");

-- CreateIndex
CREATE INDEX "certificates_companyId_employeeId_idx" ON "certificates"("companyId", "employeeId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_certifications" ADD CONSTRAINT "employee_certifications_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_items" ADD CONSTRAINT "bid_items_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_lines" ADD CONSTRAINT "cost_lines_bidItemId_fkey" FOREIGN KEY ("bidItemId") REFERENCES "bid_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_lines" ADD CONSTRAINT "cost_lines_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "cost_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_lines" ADD CONSTRAINT "cost_lines_laborRateId_fkey" FOREIGN KEY ("laborRateId") REFERENCES "labor_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_lines" ADD CONSTRAINT "cost_lines_equipmentRateId_fkey" FOREIGN KEY ("equipmentRateId") REFERENCES "equipment_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_lines" ADD CONSTRAINT "cost_lines_equipmentRentalId_fkey" FOREIGN KEY ("equipmentRentalId") REFERENCES "equipment_rentals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_lines" ADD CONSTRAINT "cost_lines_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_lines" ADD CONSTRAINT "cost_lines_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "subcontractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_codes" ADD CONSTRAINT "cost_codes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_rates" ADD CONSTRAINT "labor_rates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_rates" ADD CONSTRAINT "equipment_rates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_rentals" ADD CONSTRAINT "equipment_rentals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcontractors" ADD CONSTRAINT "subcontractors_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonding_profiles" ADD CONSTRAINT "bonding_profiles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "officers" ADD CONSTRAINT "officers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

