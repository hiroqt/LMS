/** LMS API contract for ISMS-sourced data (camelCase JSON). Read-only: ISMS owns these records. */

export interface IsmsList<T> {
  items: T[];
  source: "isms";
  /** ISO timestamp of the LMS API's last pull from ISMS. */
  syncedAt: string;
}

export interface ClassMeeting {
  day: string;
  /** "HH:mm" */
  timeFrom: string;
  /** "HH:mm" */
  timeTo: string;
  roomId: number;
  modality: number;
}

export interface IsmsClass {
  id: string;
  scheduleId: string;
  subjectId: number;
  subjectCode: string | null;
  subjectName: string;
  sectionId: number;
  sectionName: string | null;
  instructorId: string;
  instructorName: string;
  schoolYearId: number;
  semesterId: number;
  meetings: ClassMeeting[];
}

export interface IsmsStudent {
  studentId: string;
  enrollmentId: string;
  firstName: string;
  middleName: string;
  lastName: string;
}

export interface IsmsSubject {
  id: number;
  code: string | null;
  name: string;
  units: number;
  status: string;
}

export interface IsmsInstructor {
  id: string;
  employeeNo: string | null;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  honorific: string;
  departmentId: string;
  status: string;
}

export interface IsmsStatus {
  reachable: boolean;
  authorized: boolean;
  checkedAt: string;
  detail: string;
}

export interface ClassFilters {
  instructorId?: string;
  schoolYearId?: number;
  semesterId?: number;
}
