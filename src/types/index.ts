export interface Facility {
  id: number;
  department: string;
  acadOrg: number;
  facilityId: string;
  capacity: number;
  designation: string;
}

export interface ClassSection {
  id: number;
  term: string;
  acadOrg: number;
  classNbr: number;
  coursePrefix: string;
  courseNumber: string;
  classDescr: string;
  component: string;
  totEnrl: number;
  capEnrl: number;
  sessionCode: string;
  startDate: string;
  endDate: string;
  days: string;
  mtgStart: string;
  mtgEnd: string;
  instrMode: string;
  facilityId: string;
}

export interface UtilizationMetrics {
  facilityId: string;
  department: string;
  capacity: number;
  totalSections: number;
  avgEnrollment: number;
  utilizationRate: number;
  peakHours: string[];
}

export interface DepartmentSummary {
  department: string;
  totalRooms: number;
  totalCapacity: number;
  totalSections: number;
  avgUtilization: number;
}

export interface TermSummary {
  term: string;
  totalSections: number;
  totalEnrollment: number;
  avgClassSize: number;
  inPersonPercent: number;
  blendedPercent: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
