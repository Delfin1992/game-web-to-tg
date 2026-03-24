import type { CompanyDepartmentAssignment } from "../../shared/company-staffing";

export const companyAssignmentsByCompanyId = new Map<string, Map<string, CompanyDepartmentAssignment>>();
