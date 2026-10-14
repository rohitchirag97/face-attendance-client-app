import type { AttendanceLog } from "@/hooks/use-payroll-api";

export type AttendanceSummaryRow = {
  employeeId: string;
  employeeName: string;
  daysPresent: number;
  hoursWorked: number;
  checkIns: number;
  manualEntries: number;
};

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

// Pairs each check-in with the next check-out for the same employee and day.
export const summarizeAttendance = (logs: AttendanceLog[]): AttendanceSummaryRow[] => {
  const byEmployee = new Map<string, AttendanceLog[]>();
  for (const log of logs) {
    const list = byEmployee.get(log.employeeId) ?? [];
    list.push(log);
    byEmployee.set(log.employeeId, list);
  }

  const rows: AttendanceSummaryRow[] = [];
  for (const [employeeId, list] of byEmployee) {
    list.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
    const days = new Set<string>();
    let ms = 0;
    let openIn: AttendanceLog | null = null;
    for (const log of list) {
      days.add(dayKey(log.occurredAt));
      if (log.eventType === "check_in") {
        openIn = log;
      } else if (openIn && dayKey(openIn.occurredAt) === dayKey(log.occurredAt)) {
        ms += new Date(log.occurredAt).getTime() - new Date(openIn.occurredAt).getTime();
        openIn = null;
      }
    }
    rows.push({
      employeeId,
      employeeName: list[0].employeeName,
      daysPresent: days.size,
      hoursWorked: ms / 3_600_000,
      checkIns: list.filter((l) => l.eventType === "check_in").length,
      manualEntries: list.filter((l) => l.source === "manual").length,
    });
  }
  return rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
};

export const toCsv = (rows: (string | number)[][]) =>
  rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
