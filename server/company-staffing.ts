import { storage } from "./storage";
import { getPlayerProfessionId } from "./player-meta";
import {
  type CompanyDepartmentAssignment,
  type CompanyDepartmentKey,
  buildCompanyStaffingOverview,
  getPreferredDepartmentForProfession,
} from "../shared/company-staffing";
import { companyAssignmentsByCompanyId } from "./runtime/company-state";

export async function getCompanyStaffingSnapshot(companyId: string) {
  const members = await storage.getCompanyMembers(companyId);
  const companyAssignments = companyAssignmentsByCompanyId.get(companyId) ?? new Map<string, CompanyDepartmentAssignment>();
  const normalizedMembers = await Promise.all(
    members.map(async (member) => {
      const user = await storage.getUser(member.userId);
      const professionId = user ? getPlayerProfessionId(user) : null;
      const assignment = companyAssignments.get(member.userId);
      return {
        userId: member.userId,
        username: member.username,
        role: member.role,
        professionId,
        assignedDepartment: assignment?.department ?? getPreferredDepartmentForProfession(professionId),
      };
    }),
  );

  return buildCompanyStaffingOverview(normalizedMembers);
}

export async function assignCompanyMemberDepartment(
  companyId: string,
  userId: string,
  department: CompanyDepartmentKey,
) {
  const member = await storage.getMemberByUserId(companyId, userId);
  if (!member) {
    throw new Error("Сотрудник не найден в компании");
  }
  const user = await storage.getUser(userId);
  const professionId = user ? getPlayerProfessionId(user) : null;
  const companyAssignments = companyAssignmentsByCompanyId.get(companyId) ?? new Map<string, CompanyDepartmentAssignment>();
  companyAssignments.set(userId, {
    companyId,
    userId,
    department,
    professionId,
    username: member.username,
    role: member.role,
  });
  companyAssignmentsByCompanyId.set(companyId, companyAssignments);
  return getCompanyStaffingSnapshot(companyId);
}

export function clearCompanyStaffing(companyId: string) {
  companyAssignmentsByCompanyId.delete(companyId);
}
