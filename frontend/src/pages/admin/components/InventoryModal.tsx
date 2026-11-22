/**
 * หน้าต่าง Modal สำหรับเจ้าหน้าที่ใช้เพิ่มหรือแก้ไขข้อมูลอุปกรณ์กีฬาในคลัง
 */
// src/pages/Admin/components/InventoryModal.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, X, Layers, Hash, Activity, Image as ImageIcon, FileText } from 'lucide-react';

export interface InventoryItem {
  id: number;
  name: string;
  category: string;
  description?: string;
  image?: string;
  totalQty: number;
  availableQty: number;
  status: 'พร้อมใช้งาน' | 'ใช้งานอยู่' | 'ชำรุด/ซ่อมบำรุง';
}

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem: InventoryItem | null;
  onSave: (itemData: Omit<InventoryItem, 'id'>) => void;
}

// แยก Sub-form เพื่อให้ค่าเริ่มต้นโหลดตรงตาม editingItem ทันทีโดยไม่ต้องพึ่ง useEffect setState
function InventoryForm({
  editingItem,
  onClose,
  onSave,
}: {
  editingItem: InventoryItem | null;
  onClose: () => void;
  onSave: (itemData: Omit<InventoryItem, 'id'>) => void;
}) {
  const [name, setName] = useState(editingItem?.name || '');
  const [category, setCategory] = useState(editingItem?.category || 'ฟุตบอล');
  const [description, setDescription] = useState(editingItem?.description || '');
  const [image, setImage] = useState(editingItem?.image || '');
  const [totalQty, setTotalQty] = useState<number>(editingItem?.totalQty ?? 1);
  const [availableQty, setAvailableQty] = useState<number>(editingItem?.availableQty ?? 1);
  const [status, setStatus] = useState<InventoryItem['status']>(editingItem?.status || 'พร้อมใช้งาน');

  // ตรวจสอบชื่ออุปกรณ์และส่งข้อมูลฟอร์มไปบันทึก
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      category,
      description: description.trim() || undefined,
      image: image.trim() || undefined,
      totalQty: Number(totalQty),
      availableQty: Number(availableQty),
      status,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-xs text-slate-800">
      <div>
        <label className="font-bold text-gray-700 mb-1 flex items-center gap-1">
          <Layers size={13} className="text-emerald-600" /> ชื่ออุปกรณ์กีฬา
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="เช่น ลูกฟุตบอล Molten No.5"
          className="w-full bg-white text-slate-900 font-bold border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs placeholder:text-gray-400"
          required
        />
      </div>

      <div>
        <label className="font-bold text-gray-700 mb-1 block">หมวดหมู่กีฬา</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-white text-slate-900 font-bold border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs"
        >
          <option value="ฟุตบอล">ฟุตบอล</option>
          <option value="บาสเกตบอล">บาสเกตบอล</option>
          <option value="แบดมินตัน">แบดมินตัน</option>
          <option value="วอลเลย์บอล">วอลเลย์บอล</option>
          <option value="เทเบิลเทนนิส">เทเบิลเทนนิส</option>
          <option value="อื่นๆ">อื่นๆ</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="font-bold text-gray-700 mb-1 flex items-center gap-1">
            <Hash size={13} className="text-emerald-600" /> จำนวนทั้งหมด
          </label>
          <input
            type="number"
            min="1"
            value={totalQty}
            onChange={(e) => setTotalQty(Number(e.target.value))}
            className="w-full bg-white text-slate-900 font-bold border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs"
            required
          />
        </div>
        <div>
          <label className="font-bold text-gray-700 mb-1 block">จำนวนคงเหลือ</label>
          <input
            type="number"
            min="0"
            max={totalQty}
            value={availableQty}
            onChange={(e) => setAvailableQty(Number(e.target.value))}
            className="w-full bg-white text-slate-900 font-bold border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs"
            required
          />
        </div>
      </div>

      <div>
        <label className="font-bold text-gray-700 mb-1 flex items-center gap-1">
          <Activity size={13} className="text-emerald-600" /> สถานะอุปกรณ์
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as InventoryItem['status'])}
          className="w-full bg-white text-slate-900 font-bold border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs"
        >
          <option value="พร้อมใช้งาน">พร้อมใช้งาน</option>
          <option value="ใช้งานอยู่">ใช้งานอยู่</option>
          <option value="ชำรุด/ซ่อมบำรุง">ชำรุด/ซ่อมบำรุง</option>
        </select>
      </div>

      <div>
        <label className="font-bold text-gray-700 mb-1 flex items-center gap-1">
          <ImageIcon size={13} className="text-emerald-600" /> ลิงก์รูปภาพ (URL ไม่บังคับ)
        </label>
        <input
          type="url"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          placeholder="https://images.unsplash.com/..."
          className="w-full bg-white text-slate-900 font-bold border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs placeholder:text-gray-400"
        />
      </div>

      <div>
        <label className="font-bold text-gray-700 mb-1 flex items-center gap-1">
          <FileText size={13} className="text-emerald-600" /> รายละเอียดเพิ่มเติม (ไม่บังคับ)
        </label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="รายละเอียดหรือหมายเหตุอุปกรณ์..."
          className="w-full bg-white text-slate-900 font-bold border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none resize-none shadow-xs placeholder:text-gray-400"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer shadow-md"
        >
          {editingItem ? 'บันทึกการแก้ไข' : 'เพิ่มอุปกรณ์'}
        </button>
      </div>
    </form>
  );
}

// คอมโพเนนต์กรอบ Modal สำหรับเพิ่ม/แก้ไขอุปกรณ์กีฬา
export default function InventoryModal({ isOpen, onClose, editingItem, onSave }: InventoryModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div
            className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl border border-gray-200 relative text-slate-800"
            initial={{ scale: 0.92, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 12 }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="bg-emerald-100 text-emerald-800 p-2.5 rounded-xl">
                <Package size={20} />
              </div>
              <div>
                <h2 className="text-base font-black text-emerald-950">
                  {editingItem ? 'แก้ไขข้อมูลอุปกรณ์' : 'เพิ่มอุปกรณ์กีฬาใหม่'}
                </h2>
                <p className="text-[11px] text-gray-500">กรอกรายละเอียดเพื่ออัปเดตสต็อกในระบบ</p>
              </div>
            </div>

            {/* ใช้ key เพื่อให้ Form รีเซ็ต state ใหม่ทันทีเมื่อเปลี่ยนรายการที่ต้องการแก้ */}
            <InventoryForm
              key={editingItem ? editingItem.id : 'new'}
              editingItem={editingItem}
              onClose={onClose}
              onSave={onSave}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}