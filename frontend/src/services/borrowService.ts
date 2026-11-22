/**
 * โมดูลบริการเรียก API สำหรับรายการยืม-คืนอุปกรณ์, สร้าง/สแกน QR Code และยืนยันรับอุปกรณ์
 */
import api from './api';

export interface BorrowItem {
  id: number;
  userId: number;
  studentId: string;
  userName: string;
  equipmentId: number;
  equipment: string;
  qty: number;
  purpose: string | null;
  borrowDate: string;
  dueDate: string;
  status: string;
  statusType: 'pending' | 'borrowing' | 'returned' | 'overdue';
}

export interface CreateBorrowPayload {
  equipmentId: number;
  quantity: number;
  purpose: string;
  borrowDate: string;
  dueDate: string;
}

export interface QrTokenResponse {
  qrToken: string;
  pin: string;
  step: number;
  secondsRemaining: number;
  borrow: BorrowItem | null;
}

// ดึงรายการยืม-คืนทั้งหมด (หรือเฉพาะของผู้ใช้ที่ล็อกอิน)
export async function listBorrows(): Promise<BorrowItem[]> {
  const { data } = await api.get<{ borrows: BorrowItem[] }>('/borrow');
  return data.borrows;
}

// ขอ Dynamic QR Token และ PIN 6 หลักสำหรับนำไปยืนยันรับหรือคืนอุปกรณ์
export async function getQrToken(borrowId?: number): Promise<QrTokenResponse> {
  const params = borrowId ? { borrowId } : undefined;
  const { data } = await api.get<QrTokenResponse>('/borrow/qr-token', { params });
  return data;
}

// ส่งคำขอยืมอุปกรณ์กีฬาใหม่ไปยังเซิร์ฟเวอร์
export async function createBorrow(payload: CreateBorrowPayload): Promise<BorrowItem> {
  const { data } = await api.post<{ borrow: BorrowItem }>('/borrow', payload);
  return data.borrow;
}

// กดยืนยันการรับอุปกรณ์ด้วยตนเอง (เปลี่ยนสถานะจากรอรับเป็นกำลังยืม)
export async function confirmPickup(
  id: number
): Promise<{ message: string; borrow: BorrowItem }> {
  const { data } = await api.post<{ message: string; borrow: BorrowItem }>(
    `/borrow/${id}/pickup`
  );
  return data;
}

// บันทึกการคืนอุปกรณ์กีฬาตามรหัสรายการยืม
export async function returnBorrow(id: number): Promise<BorrowItem> {
  const { data } = await api.patch<{ borrow: BorrowItem }>(`/borrow/${id}/return`);
  return data.borrow;
}

// ลบรายการยืมออกจากระบบ (สำหรับเจ้าหน้าที่)
export async function deleteBorrow(id: number): Promise<void> {
  await api.delete(`/borrow/${id}`);
}

// ส่งรหัสจากการสแกน QR หรือกรอกรหัสไปตรวจสอบและอัปเดตสถานะรับ/คืน
export async function verifyScan(
  token: string
): Promise<{ action?: 'pickup' | 'return'; message: string; borrow: BorrowItem }> {
  const { data } = await api.post<{
    action?: 'pickup' | 'return';
    message: string;
    borrow: BorrowItem;
  }>('/borrow/verify-scan', { token });
  return data;
}

export const borrowService = {
  listBorrows,
  getQrToken,
  createBorrow,
  createRequest: createBorrow,
  confirmPickup,
  returnBorrow,
  deleteBorrow,
  verifyScan,
};

export default borrowService;
