/**
 * โมดูลบริการเรียก API สำหรับจัดการข้อมูลคลังอุปกรณ์กีฬาและการจัดรูปแบบรหัสอุปกรณ์
 */
import api from './api';

export interface EquipmentItem {
  id: number;
  name: string;
  category: string | null;
  description: string | null;
  desc: string | null;
  total: number;
  available: number;
  totalQty: number;
  availableQty: number;
  image: string | null;
  icon: string | null;
  status: string;
}

// แปลงรหัสตัวเลขอุปกรณ์ให้เป็นรูปแบบมาตรฐาน เช่น EQ-0001
export function formatEquipCode(id: number): string {
  return `EQ-${String(id).padStart(4, '0')}`;
}

// ดึงรายการอุปกรณ์กีฬาทั้งหมด พร้อมตัวกรองหมวดหมู่และคำค้นหา
export async function listEquipment(category?: string, search?: string): Promise<EquipmentItem[]> {
  const params: Record<string, string> = {};
  if (category && category !== 'ทั้งหมด') params.category = category;
  if (search) params.search = search;
  const { data } = await api.get<{ equipment: EquipmentItem[] }>('/equip', { params });
  return data.equipment;
}

// ดึงข้อมูลรายละเอียดอุปกรณ์ 1 ชิ้นตามรหัส ID
export async function getEquipment(id: number): Promise<EquipmentItem> {
  const { data } = await api.get<{ equipment: EquipmentItem }>(`/equip/${id}`);
  return data.equipment;
}

// เพิ่มรายการอุปกรณ์กีฬาใหม่เข้าสู่ระบบ (สำหรับเจ้าหน้าที่)
export async function createEquipment(item: {
  name: string;
  category?: string;
  description?: string;
  totalQty: number;
  availableQty: number;
  image?: string;
  icon?: string;
  status?: string;
}): Promise<EquipmentItem> {
  const { data } = await api.post<{ equipment: EquipmentItem }>('/equip', item);
  return data.equipment;
}

// แก้ไขข้อมูลและจำนวนสต็อกของอุปกรณ์กีฬาที่มีอยู่
export async function updateEquipment(
  id: number,
  item: {
    name: string;
    category?: string;
    description?: string;
    totalQty: number;
    availableQty: number;
    image?: string;
    icon?: string;
    status?: string;
  },
): Promise<EquipmentItem> {
  const { data } = await api.put<{ equipment: EquipmentItem }>(`/equip/${id}`, item);
  return data.equipment;
}

// ลบอุปกรณ์กีฬาออกจากระบบตามรหัส ID
export async function deleteEquipment(id: number): Promise<void> {
  await api.delete(`/equip/${id}`);
}

export interface SerialItem {
  id: number;
  equipmentId: number;
  itemCode: string;
  status: 'available' | 'reserved' | 'borrowed' | 'damaged';
  borrowId: number | null;
  createdAt: string;
}

// ดึงรหัสประจำชิ้นทั้งหมด (Serial Tracking) ของอุปกรณ์
export async function listEquipmentItems(equipId: number): Promise<SerialItem[]> {
  const { data } = await api.get<{ items: SerialItem[] }>(`/equip/${equipId}/items`);
  return data.items;
}

// อัปเดตสถานะของอุปกรณ์รายชิ้น (เช่น Admin กดเปลี่ยนเป็น "ชำรุด (damaged)" หรือ "พร้อมใช้งาน (available)")
export async function updateItemStatus(
  itemId: number,
  status: 'available' | 'damaged'
): Promise<{ message: string; equipment: EquipmentItem | null }> {
  const { data } = await api.patch<{ message: string; equipment: EquipmentItem | null }>(
    `/equip/items/${itemId}/status`,
    { status }
  );
  return data;
}

// จัดระเบียบคลังอุปกรณ์ให้ตรงกับ 5 รายการหลักมาตรฐาน (สำหรับ Admin)
export async function consolidateEquipment(): Promise<void> {
  await api.post('/equip/consolidate');
}

