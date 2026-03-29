import { registerRuntimeSnapshotProvider } from "../storage";
import type { CompanyDepartmentAssignment } from "../../shared/company-staffing";

export const companyAssignmentsByCompanyId = new Map<string, Map<string, CompanyDepartmentAssignment>>();

export function exportCompanyAssignmentsSnapshot() {
  return Array.from(
    companyAssignmentsByCompanyId.entries(),
    ([companyId, assignments]) => [companyId, Array.from(assignments.entries())] as const,
  );
}

export function importCompanyAssignmentsSnapshot(snapshot: unknown) {
  companyAssignmentsByCompanyId.clear();
  if (!Array.isArray(snapshot)) return;
  for (const entry of snapshot) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const companyId = String(entry[0] ?? "").trim();
    const rawAssignments = Array.isArray(entry[1]) ? entry[1] : [];
    if (!companyId) continue;
    const assignments = new Map<string, CompanyDepartmentAssignment>();
    for (const assignmentEntry of rawAssignments) {
      if (!Array.isArray(assignmentEntry) || assignmentEntry.length < 2) continue;
      const userId = String(assignmentEntry[0] ?? "").trim();
      const assignment = assignmentEntry[1];
      if (!userId || !assignment || typeof assignment !== "object") continue;
      assignments.set(userId, assignment as CompanyDepartmentAssignment);
    }
    companyAssignmentsByCompanyId.set(companyId, assignments);
  }
}

export function clearCompanyAssignmentsState() {
  companyAssignmentsByCompanyId.clear();
}

registerRuntimeSnapshotProvider("company-staffing", {
  exportSnapshot: exportCompanyAssignmentsSnapshot,
  importSnapshot: importCompanyAssignmentsSnapshot,
  clear: clearCompanyAssignmentsState,
});
