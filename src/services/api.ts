import type { Facility, ClassSection, ApiResponse } from '../types';

const API_BASE = '/api';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const data: ApiResponse<T> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Unknown error');
  }

  return data.data as T;
}

export async function getFacilities(): Promise<Facility[]> {
  return fetchApi<Facility[]>('facilities');
}

export async function getSections(params?: {
  term?: string;
  facilityId?: string;
  department?: string;
}): Promise<ClassSection[]> {
  const searchParams = new URLSearchParams();
  if (params?.term) searchParams.set('term', params.term);
  if (params?.facilityId) searchParams.set('facilityId', params.facilityId);
  if (params?.department) searchParams.set('department', params.department);

  const query = searchParams.toString();
  return fetchApi<ClassSection[]>(`sections${query ? `?${query}` : ''}`);
}

export interface TermInfo {
  code: string;
  label: string;
}

export interface AnalyticsData {
  availableTerms: TermInfo[];
  selectedTerm: string;
  termSummaries: Array<{
    term: string;
    totalSections: number;
    totalEnrollment: number;
    avgClassSize: number;
    inPersonPercent: number;
    blendedPercent: number;
  }>;
  departmentSummaries: Array<{
    department: string;
    totalRooms: number;
    totalCapacity: number;
    totalSections: number;
    avgUtilization: number;
  }>;
  roomUtilization: Array<{
    facilityId: string;
    department: string;
    capacity: number;
    designation: string;
    totalSections: number;
    avgEnrollment: number;
    utilizationRate: number;
  }>;
  coursesByDepartment: Array<{
    department: string;
    course: string;
    sectionCount: number;
    totalEnrollment: number;
  }>;
  timeSlotAnalysis: Array<{
    timeSlot: string;
    days: string;
    sectionCount: number;
  }>;
  enrollmentTrends: Array<{
    term: string;
    department: string;
    totalEnrollment: number;
    sectionCount: number;
  }>;
}

export async function getAnalytics(term?: string): Promise<AnalyticsData> {
  const query = term ? `?term=${term}` : '';
  return fetchApi<AnalyticsData>(`analytics${query}`);
}

export async function sendChatMessage(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, history }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Unknown error');
  }

  return data.data.message;
}

export interface CourseRecommendation {
  course: string;
  description: string;
  currentSections: number;
  projectedSections: number;
  currentEnrollment: number;
  avgClassSize: number;
  growthRate: string | null;
  recommendation: 'increase' | 'decrease' | 'maintain';
  reason: string;
  historicalData: {
    fall2023: { sections: number; enrollment: number };
    fall2024: { sections: number; enrollment: number };
    fall2025: { sections: number; enrollment: number };
  };
}

export interface RoomRecommendation {
  facilityId: string;
  department: string;
  capacity: number;
  designation: string;
  sectionsScheduled: number;
  avgEnrollment: number | null;
  utilizationRate: number | null;
  recommendation: 'optimal' | 'underutilized' | 'at_capacity';
  reason: string;
}

export interface RecommendationsData {
  summary: {
    totalCourses: number;
    coursesToIncrease: number;
    coursesToDecrease: number;
    coursesToMaintain: number;
    underutilizedRooms: number;
    atCapacityRooms: number;
    projectedTotalSections: number;
    currentTotalSections: number;
  };
  courseRecommendations: CourseRecommendation[];
  roomRecommendations: RoomRecommendation[];
  targetTerm: string;
  basedOnTerm: string;
}

export async function getRecommendations(): Promise<RecommendationsData> {
  return fetchApi<RecommendationsData>('recommendations');
}

// Scheduler types and functions
export interface ScheduleAssignment {
  id: number;
  course: string;
  description: string;
  projectedEnrollment: number;
  days: string | null;
  startTime: string | null;
  endTime: string | null;
  instrMode: string;
  assignedRoom: string | null;
  roomCapacity: number | null;
  roomDepartment: string | null;
  previousRoom: string | null;
  hasConflict: boolean;
  isLocked: boolean;
  notes: string;
  conflictsWith?: number[];
}

export interface SchedulerFacility {
  facility_id: string;
  department: string;
  capacity: number;
  designation: string;
  scheduledSections: number;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  days: string;
}

export interface ScheduleData {
  targetTerm: string;
  basedOnTerm: string;
  totalAssignments: number;
  conflictCount: number;
  roomChanges: number;
  assignments: ScheduleAssignment[];
  facilities: SchedulerFacility[];
  timeSlots: TimeSlot[];
  lastModified?: string;
}

export async function generateSchedule(): Promise<ScheduleData> {
  return fetchApi<ScheduleData>('scheduler/generate');
}

export async function reassignCourse(
  assignmentId: number,
  newRoomId: string | null,
  newDays: string | null,
  newStartTime: string | null,
  newEndTime: string | null,
  currentSchedule: ScheduleData
): Promise<ScheduleData> {
  const response = await fetch(`${API_BASE}/scheduler/reassign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assignmentId,
      newRoomId,
      newDays,
      newStartTime,
      newEndTime,
      currentSchedule,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Unknown error');
  }

  return data.data;
}

export interface AvailableSlot extends TimeSlot {
  isAvailable: boolean;
  occupiedBy: string | null;
}

export async function getAvailableSlots(
  roomId: string,
  currentSchedule?: ScheduleData
): Promise<{ roomId: string; slots: AvailableSlot[] }> {
  const params = new URLSearchParams({ roomId });
  if (currentSchedule) {
    params.set('currentSchedule', JSON.stringify(currentSchedule));
  }
  return fetchApi<{ roomId: string; slots: AvailableSlot[] }>(
    `scheduler/available-slots?${params.toString()}`
  );
}

// Building 6 Planning types
export interface SectionDetail {
  course: string;
  description: string;
  enrollment: number;
  days: string | null;
  startTime: string | null;
  endTime: string | null;
  instrMode: string;
  isInDiscipline: boolean;
  acadOrg: number;
}

export interface RoomUsageAnalysis {
  facilityId: string;
  department: string;
  capacity: number;
  designation: string;
  building: string;
  totalSections: number;
  inDisciplineSections: number;
  overflowSections: number;
  avgEnrollment: number;
  maxEnrollment: number;
  sections: SectionDetail[];
  isOutlier: boolean;
  isDraftingRoom: boolean;
  isBuilding2: boolean;
  isBuilding8: boolean;
}

export interface ArchitectureLectureClass {
  course: string;
  description: string;
  currentRoom: string | null;
  enrollment: number;
  days: string | null;
  startTime: string | null;
  endTime: string | null;
  instrMode: string;
  isOurRoom: boolean;
  roomDepartment: string;
  roomDesignation: string;
  building: string;
}

export interface TechnologyClass {
  course: string;
  description: string;
  currentRoom: string | null;
  enrollment: number;
  days: string | null;
  startTime: string | null;
  endTime: string | null;
  instrMode: string;
  building: string;
  isBuilding2: boolean;
  isBuilding8: boolean;
  isBuilding6: boolean;
  roomCapacity: number;
  roomDesignation: string;
}

export interface EnrollmentBracket {
  label: string;
  min: number;
  max: number;
  count: number;
  sections: TechnologyClass[];
}

export interface ProposedRoom {
  id: string;
  capacity: number;
  designation: string;
  floor: number;
}

export interface ProposedFloor {
  rooms: ProposedRoom[];
  totalCapacity: number;
  totalRooms: number;
  note?: string;
}

export interface Building6Summary {
  currentTechnologyRooms: {
    building2: number;
    building8: number;
    building6: number;
    total: number;
  };
  currentCapacity: {
    building2: number;
    building8: number;
    total: number;
  };
  proposedCapacity: {
    floors2and3: number;
    aiCommons: number;
    total: number;
  };
  sectionsToMove: {
    fromBuilding2: number;
    fromBuilding8: number;
    total: number;
  };
  enrollmentDistribution: Record<string, EnrollmentBracket>;
  needsFifthRoom: boolean;
}

export interface Building6Data {
  summary: Building6Summary;
  proposedBuilding6: {
    floor1: ProposedFloor;
    floor2: ProposedFloor;
    floor3: ProposedFloor;
  };
  roomUsageAnalysis: RoomUsageAnalysis[];
  architectureLectureClasses: ArchitectureLectureClass[];
  technologyClasses: TechnologyClass[];
  building6Candidates: TechnologyClass[];
  instrModeBreakdown: {
    inPerson: number;
    blended: number;
    online: number;
  };
  currentRooms: {
    building2: RoomUsageAnalysis[];
    building8: RoomUsageAnalysis[];
  };
  notes: string[];
}

export async function getBuilding6Analysis(): Promise<Building6Data> {
  return fetchApi<Building6Data>('building6');
}
