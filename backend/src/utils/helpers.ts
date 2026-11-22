/**
 * ยูทิลิตีฟังก์ชันทั่วไปสำหรับตรวจสอบและแปลงข้อมูลในฝั่ง Backend
 */

/**
 * แปลงค่าอินพุตให้เป็นข้อความและตัดช่องว่างหัวท้าย (Trim)
 */
export function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * ตรวจสอบและแปลงค่าจำนวนอุปกรณ์ให้เป็นจำนวนเต็มที่ไม่ติดลบ
 */
export function readQuantity(value: unknown): number | null {
  const quantity = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(quantity) || quantity < 0) {
    return null;
  }
  return quantity;
}

/**
 * ตรวจสอบรูปแบบวันที่ว่าเป็น YYYY-MM-DD หรือไม่
 */
export function isDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
