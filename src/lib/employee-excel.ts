import type { EmploymentInput } from "@/hooks/use-payroll-api";
import type { EmployeeStatutoryInput } from "@/hooks/use-statutory";

export type BulkRole = "employee" | "hr" | "admin";

export type BulkEmployeeRow = {
  row: number;
  fname: string;
  lname: string;
  phone: string;
  role: BulkRole;
  employment: Partial<EmploymentInput>;
  statutory: EmployeeStatutoryInput | null;
  error?: string;
};

export type SheetLookups = {
  departments: { id: string; name: string }[];
  shifts: { id: string; name: string }[];
};

const SHEET_NAME = "Employees";

const OPTIONS = {
  employmentType: { "full time": "full_time", "part time": "part_time", contractor: "contractor", intern: "intern" },
  compensationType: { hourly: "hourly", daily: "daily", "fixed salary": "fixed_salary" },
  payFrequency: {
    weekly: "weekly",
    "every two weeks": "biweekly",
    "twice a month": "semimonthly",
    monthly: "monthly",
  },
  gender: { male: "male", female: "female", other: "other" },
  taxRegime: { new: "new", old: "old" },
  yesNo: { yes: true, no: false },
} as const;

const label = (map: Record<string, unknown>) =>
  Object.keys(map).map((key) => key.replace(/\b\w/g, (c) => c.toUpperCase()));

type Column = {
  header: string;
  width: number;
  required?: boolean;
  text?: boolean;
  list?: string[] | "departments" | "shifts";
  example: string;
  help: string;
};

const columns = (allowElevatedRoles: boolean): Column[] => [
  { header: "First Name", width: 18, required: true, example: "Asha", help: "Required." },
  { header: "Last Name", width: 18, required: true, example: "Sharma", help: "Required." },
  { header: "Country Code", width: 14, text: true, required: true, example: "91", help: "Digits only. Blank = 91." },
  { header: "Phone Number", width: 16, text: true, required: true, example: "9876543210", help: "10-digit mobile number, without country code." },
  { header: "Role", width: 12, list: allowElevatedRoles ? ["Employee", "HR", "Admin"] : ["Employee"], example: "Employee", help: "Blank = Employee." },
  { header: "Employee Code", width: 15, text: true, example: "EMP001", help: "Optional, up to 32 characters." },
  { header: "Job Title", width: 20, example: "Sales Executive", help: "Optional." },
  { header: "Department", width: 20, list: "departments", example: "", help: "Pick from the list (create departments first)." },
  { header: "Shift", width: 20, list: "shifts", example: "", help: "Pick from the list (create shifts first)." },
  { header: "Employment Type", width: 17, list: label(OPTIONS.employmentType), example: "Full Time", help: "Optional." },
  { header: "Hire Date", width: 13, text: true, example: "2026-04-01", help: "Format YYYY-MM-DD." },
  { header: "Compensation Type", width: 18, list: label(OPTIONS.compensationType), example: "Fixed Salary", help: "Optional." },
  { header: "Compensation Amount", width: 20, example: "25000", help: "Number. Amount per hour, day or pay period depending on type." },
  { header: "Currency", width: 10, text: true, example: "INR", help: "3-letter code, e.g. INR." },
  { header: "Pay Frequency", width: 16, list: label(OPTIONS.payFrequency), example: "Monthly", help: "Optional." },
  { header: "Gender", width: 10, list: label(OPTIONS.gender), example: "Female", help: "Optional." },
  { header: "PAN", width: 14, text: true, example: "ABCDE1234F", help: "Format ABCDE1234F." },
  { header: "UAN", width: 16, text: true, example: "", help: "12 digits." },
  { header: "ESI Number", width: 18, text: true, example: "", help: "10 to 17 digits." },
  { header: "Tax Regime", width: 12, list: label(OPTIONS.taxRegime), example: "New", help: "Blank = New." },
  { header: "PF Applicable", width: 14, list: ["Yes", "No"], example: "Yes", help: "Blank = Yes." },
  { header: "ESI Applicable", width: 15, list: ["Yes", "No"], example: "Yes", help: "Blank = Yes." },
];

const cellText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const rich = value as { text?: unknown; richText?: { text: string }[]; result?: unknown };
    if (Array.isArray(rich.richText)) return rich.richText.map((part) => part.text).join("").trim();
    if (rich.text !== undefined) return String(rich.text).trim();
    if (rich.result !== undefined) return cellText(rich.result);
  }
  return String(value).trim();
};

const columnLetter = (index: number) => {
  let n = index;
  let out = "";
  while (n > 0) {
    out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
};

export const downloadEmployeeTemplate = async (
  allowElevatedRoles: boolean,
  lookups: SheetLookups,
) => {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet(SHEET_NAME);
  const cols = columns(allowElevatedRoles);

  // Names live on a hidden sheet so long lists are not limited by the 255-char inline cap.
  const lists = workbook.addWorksheet("Lists", { state: "hidden" });
  lookups.departments.forEach((d, i) => {
    lists.getCell(`A${i + 1}`).value = d.name;
  });
  lookups.shifts.forEach((s, i) => {
    lists.getCell(`B${i + 1}`).value = s.name;
  });

  sheet.columns = cols.map((column) => ({ header: column.header, width: column.width }));
  const headerRow = sheet.getRow(1);
  cols.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: column.required ? "FFB91C1C" : "FF1F2937" },
    };
    if (column.text) sheet.getColumn(index + 1).numFmt = "@";
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const example = sheet.addRow(cols.map((column) => column.example));
  example.font = { italic: true, color: { argb: "FF6B7280" } };

  cols.forEach((column, index) => {
    if (!column.list) return;
    let formula: string | null = null;
    if (column.list === "departments") {
      if (lookups.departments.length > 0) formula = `Lists!$A$1:$A$${lookups.departments.length}`;
    } else if (column.list === "shifts") {
      if (lookups.shifts.length > 0) formula = `Lists!$B$1:$B$${lookups.shifts.length}`;
    } else {
      formula = `"${column.list.join(",")}"`;
    }
    if (!formula) return;
    const letter = columnLetter(index + 1);
    for (let row = 2; row <= 501; row += 1) {
      sheet.getCell(`${letter}${row}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [formula],
        showErrorMessage: true,
        errorTitle: `Invalid ${column.header}`,
        error: "Choose a value from the list.",
      };
    }
  });

  const help = workbook.addWorksheet("Instructions");
  help.getColumn(1).width = 28;
  help.getColumn(2).width = 80;
  help.getCell("A1").value = "How to fill the Employees sheet";
  help.getCell("A1").font = { bold: true, size: 14 };
  help.getCell("A2").value =
    "One employee per row (max 500). Red headers are required. The grey row is an example; overwrite or delete it. Do not rename the sheet or headers.";
  help.getCell("A2").alignment = { wrapText: true };
  help.mergeCells("A2:B2");
  help.getRow(2).height = 32;
  help.getRow(4).values = ["Column", "Notes"];
  help.getRow(4).font = { bold: true };
  cols.forEach((column, index) => {
    help.getRow(5 + index).values = [column.header + (column.required ? " *" : ""), column.help];
  });
  help.getCell(`A${6 + cols.length}`).value =
    "Salary components (allowances/deductions) are not part of this sheet; add them from the employee's edit screen.";

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "vetanly-employee-template.xlsx";
  link.click();
  URL.revokeObjectURL(url);
};

const pick = <T>(map: Record<string, T>, value: string): T | undefined =>
  map[value.trim().toLowerCase()];

export const parseEmployeeSheet = async (
  file: File,
  allowElevatedRoles: boolean,
  lookups: SheetLookups,
): Promise<BulkEmployeeRow[]> => {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.getWorksheet(SHEET_NAME) ?? workbook.worksheets[0];
  if (!sheet) throw new Error("The file has no sheets.");

  const cols = columns(allowElevatedRoles);
  const index = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    index.set(cellText(cell.value).toLowerCase(), colNumber);
  });
  const missing = cols.filter((c) => c.required && !index.has(c.header.toLowerCase()));
  if (missing.length > 0) {
    throw new Error(
      `Missing column: ${missing.map((c) => c.header).join(", ")}. Download the template again and keep its headers.`,
    );
  }

  const byName = (items: { id: string; name: string }[]) =>
    Object.fromEntries(items.map((item) => [item.name.trim().toLowerCase(), item.id]));
  const departmentIds = byName(lookups.departments);
  const shiftIds = byName(lookups.shifts);

  const rows: BulkEmployeeRow[] = [];
  const seen = new Set<string>();
  const seenCodes = new Set<string>();
  sheet.eachRow({ includeEmpty: false }, (excelRow, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (header: string) => {
      const col = index.get(header.toLowerCase());
      return col ? cellText(excelRow.getCell(col).value) : "";
    };
    if (cols.every((c) => !get(c.header))) return;

    const fname = get("First Name");
    const lname = get("Last Name");
    const digits = get("Phone Number").replace(/\D/g, "");
    const countryCode = get("Country Code").replace(/\D/g, "") || "91";
    const phone = `${countryCode}${digits}`;
    const role = pick<BulkRole>(
      { employee: "employee", hr: "hr", admin: "admin" },
      get("Role") || "employee",
    );

    const errors: string[] = [];
    if (!fname || !lname) errors.push("First and last name are required");
    if (digits.length !== 10) errors.push("Phone number must be 10 digits");
    else if (!/^\d{11,15}$/.test(phone)) errors.push("Invalid country code or phone");
    if (!role) errors.push("Role must be Employee, HR or Admin");
    else if (role !== "employee" && !allowElevatedRoles) errors.push("You can only add employees");
    if (seen.has(phone)) errors.push("Duplicate phone number in this file");
    seen.add(phone);

    const employment: Partial<EmploymentInput> = {};
    const code = get("Employee Code");
    if (code) {
      if (code.length > 32) errors.push("Employee code is too long");
      else if (seenCodes.has(code.toLowerCase())) errors.push(`Employee code "${code}" is repeated in this file`);
      else employment.employeeCode = code;
      seenCodes.add(code.toLowerCase());
    }
    const title = get("Job Title");
    if (title) employment.jobTitle = title.slice(0, 100);

    const department = get("Department");
    if (department) {
      const id = departmentIds[department.toLowerCase()];
      if (id) employment.departmentId = id;
      else errors.push(`Unknown department "${department}"`);
    }
    const shift = get("Shift");
    if (shift) {
      const id = shiftIds[shift.toLowerCase()];
      if (id) employment.shiftId = id;
      else errors.push(`Unknown shift "${shift}"`);
    }

    const employmentType = get("Employment Type");
    if (employmentType) {
      const found = pick<string>(OPTIONS.employmentType, employmentType);
      if (found) employment.employmentType = found as EmploymentInput["employmentType"];
      else errors.push("Invalid Employment Type");
    }
    const compensationType = get("Compensation Type");
    if (compensationType) {
      const found = pick<string>(OPTIONS.compensationType, compensationType);
      if (found) employment.compensationType = found as EmploymentInput["compensationType"];
      else errors.push("Invalid Compensation Type");
    }
    const payFrequency = get("Pay Frequency");
    if (payFrequency) {
      const found = pick<string>(OPTIONS.payFrequency, payFrequency);
      if (found) employment.payFrequency = found as EmploymentInput["payFrequency"];
      else errors.push("Invalid Pay Frequency");
    }

    const hire = get("Hire Date");
    if (hire) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(hire) && !Number.isNaN(Date.parse(hire))) employment.hireDate = hire;
      else errors.push("Hire Date must be YYYY-MM-DD");
    }
    const amount = get("Compensation Amount");
    if (amount) {
      const value = Number(amount.replace(/,/g, ""));
      if (Number.isFinite(value) && value >= 0) employment.compensationAmount = value;
      else errors.push("Compensation Amount must be a number");
    }
    const currency = get("Currency");
    if (currency) {
      if (/^[A-Za-z]{3}$/.test(currency)) employment.compensationCurrency = currency.toUpperCase();
      else errors.push("Currency must be a 3-letter code");
    }

    const pan = get("PAN").toUpperCase();
    const uan = get("UAN");
    const esi = get("ESI Number");
    const gender = get("Gender");
    const regime = get("Tax Regime");
    const pf = get("PF Applicable");
    const esiApplicable = get("ESI Applicable");
    if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) errors.push("PAN looks like ABCDE1234F");
    if (uan && !/^\d{12}$/.test(uan)) errors.push("UAN must be 12 digits");
    if (esi && !/^\d{10,17}$/.test(esi)) errors.push("ESI Number must be 10 to 17 digits");
    const genderValue = gender ? pick<string>(OPTIONS.gender, gender) : "";
    if (gender && !genderValue) errors.push("Invalid Gender");
    const regimeValue = regime ? pick<string>(OPTIONS.taxRegime, regime) : "new";
    if (regime && !regimeValue) errors.push("Invalid Tax Regime");
    const pfValue = pf ? pick<boolean>(OPTIONS.yesNo, pf) : true;
    const esiFlag = esiApplicable ? pick<boolean>(OPTIONS.yesNo, esiApplicable) : true;
    if (pf && pfValue === undefined) errors.push("PF Applicable must be Yes or No");
    if (esiApplicable && esiFlag === undefined) errors.push("ESI Applicable must be Yes or No");

    const hasStatutory = Boolean(pan || uan || esi || gender || regime || pf || esiApplicable);
    const statutory: EmployeeStatutoryInput | null = hasStatutory
      ? {
          uan,
          esiNumber: esi,
          gender: (genderValue ?? "") as "male" | "female" | "other" | "",
          pfApplicable: pfValue ?? true,
          esiApplicable: esiFlag ?? true,
          taxRegime: (regimeValue ?? "new") as "new" | "old",
          declaredDeductions: 0,
          ...(pan ? { pan } : {}),
        }
      : null;

    rows.push({
      row: rowNumber,
      fname,
      lname,
      phone,
      role: role ?? "employee",
      employment,
      statutory,
      error: errors.length > 0 ? errors.join("; ") : undefined,
    });
  });
  if (rows.length === 0) throw new Error("No employee rows found in the file.");
  if (rows.length > 500) throw new Error("A file can contain at most 500 employees.");
  return rows;
};
