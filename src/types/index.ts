export type UserRole = "admin" | "teacher" | "student" | "customer";

export interface CurriculumModule {
  id: string;
  title: string;
  grade: string;
  subject: string;
  module: string;
  description: string;
  judgingLogic?: string;
  assets: Array<{ type: "video" | "code" | "doc" | "stl"; url: string; label: string }>;
  codeSnippet?: string;
  priceYearly?: number;
  published?: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  image: string;
  imageData?: string;
  gallery?: string[]; // urls
  galleryData?: string[]; // data URLs
  price: number;
  originalPrice?: number;
  deliveryEta: string;
  expectedDelivery: string;
  stock: number;
  sku: string;
  highlights: string[];
  featured?: boolean;
  badge?: string;
}

export interface Order {
  id: string;
  status: "pending" | "processing" | "shipped" | "delivered";
  total: number;
  createdAt: string;
  items: Array<{ name: string; qty: number }>;
}

export interface SteamhProjectLink {
  label?: string;
  url: string;
}

export interface SteamhProject {
  id: string;
  studentId: string | null;
  studentName: string;
  schoolName: string;
  grade: string;
  subject: string;
  title: string;
  summary: string;
  description: string;
  challenge: string;
  solution: string;
  toolsUsed: string[];
  tags: string[];
  imageUrls: string[];
  videoUrls: string[];
  attachmentUrls: string[];
  externalLinks: SteamhProjectLink[];
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SteamhAssignment {
  id: string;
  teacherId: string;
  teacherName: string;
  studentId: string;
  studentName: string;
  title: string;
  instructions: string | null;
  subject: string | null;
  grade: string | null;
  dueAt: string;
  status: "assigned" | "submitted" | "closed" | string;
  submittedProjectId: string | null;
  submittedAt: string | null;
  lastRemindedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
