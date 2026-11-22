/**
 * หน้าต่างจัดการรหัสประจำชิ้น (Asset / Serial Tracking) และการแจ้งชำรุด/ซ่อมแซมสำหรับ Admin
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wrench, CheckCircle2, AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import type { InventoryItem } from './InventoryModal';
import {
  listEquipmentItems,
  updateItemStatus,
  formatEquipCode,
  type SerialItem,
  type EquipmentItem,
} from '../../../services/equipService';

interface SerialItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: InventoryItem | null;
  onEquipmentUpdated?: (updated: EquipmentItem) => void;
}

export default function SerialItemsModal({
  isOpen,
  onClose,
  equipment,
  onEquipmentUpdated,
}: SerialItemsModalProps) {
  const [items, setItems] = useState<SerialItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const fetchItems = useCallback(async (equipId: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listEquipmentItems(equipId);
      setItems(data);
    } catch {
      setError('ไม่สามารถโหลดข้อมูลรหัสประจำชิ้นได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && equipment) {
      void fetchItems(equipment.id);
    } else {
      setItems([]);
      setError(null);
      setSuccessToast(null);
    }
  }, [isOpen, equipment, fetchItems]);

  const handleToggleStatus = async (item: SerialItem) => {
    if (processingId !== null) return;
    const nextStatus = item.status === 'damaged' ? 'available' : 'damaged';

    setProcessingId(item.id);
    setError(null);

    try {
      const res = await updateItemStatus(item.id, nextStatus);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i))
      );
      setSuccessToast(res.message);
      setTimeout(() => setSuccessToast(null), 3000);

      if (res.equipment && onEquipmentUpdated) {
        onEquipmentUpdated(res.equipment);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถอัปเดตสถานะอุปกรณ์ได้';
      setError(msg);
    } finally {
      setProcessingId(null);
    }
  };

  if (!isOpen || !equipment) return null;

  const damagedCount = items.filter((i) => i.status === 'damaged').length;
  const availableCount = items.filter((i) => i.status === 'available').length;
  const activeCount = items.filter((i) => i.status === 'borrowed' || i.status === 'reserved').length;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <motion.div
          className="bg-white/95 backdrop-blur-2xl rounded-3xl p-6 sm:p-7 max-w-xl w-full shadow-2xl border border-white/80 max-h-[90vh] flex flex-col"
          initial={{ scale: 0.94, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 10 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                  {formatEquipCode(equipment.id)}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  รหัสอุปกรณ์รายชิ้น (Asset Serials)
                </h3>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {equipment.name} • หมวดหมู่ {equipment.category}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Stats Badges */}
          <div className="grid grid-cols-3 gap-2 py-3 border-b border-gray-100 text-center text-xs">
            <div className="bg-emerald-50 rounded-xl p-2 border border-emerald-100">
              <span className="text-[10px] font-bold text-emerald-700">พร้อมใช้งาน</span>
              <p className="font-black text-emerald-900 text-base">{availableCount} ชิ้น</p>
            </div>
            <div className="bg-sky-50 rounded-xl p-2 border border-sky-100">
              <span className="text-[10px] font-bold text-sky-700">ยืม/จองอยู่</span>
              <p className="font-black text-sky-900 text-base">{activeCount} ชิ้น</p>
            </div>
            <div className="bg-red-50 rounded-xl p-2 border border-red-100">
              <span className="text-[10px] font-bold text-red-700">ชำรุด (Damaged)</span>
              <p className="font-black text-red-900 text-base">{damagedCount} ชิ้น</p>
            </div>
          </div>

          {/* Alerts */}
          {successToast && (
            <div className="mt-3 bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-2 rounded-xl border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              <span>{successToast}</span>
            </div>
          )}
          {error && (
            <div className="mt-3 bg-red-50 text-red-700 text-xs font-bold px-3 py-2 rounded-xl border border-red-200">
              {error}
            </div>
          )}

          {/* Items List */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
            {loading ? (
              <div className="py-12 text-center text-gray-400 text-xs">
                <Loader2 size={24} className="animate-spin text-emerald-600 mx-auto mb-2" />
                กำลังโหลดรหัสประจำชิ้น...
              </div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-xs">
                ไม่พบรหัสประจำชิ้นสำหรับอุปกรณ์นี้
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/80 border border-gray-100 hover:border-gray-200 transition-all text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-sm text-slate-800 bg-white border border-gray-200 px-2.5 py-1 rounded-xl shadow-xs">
                      {item.itemCode}
                    </span>
                    <div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'available'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'borrowed'
                            ? 'bg-amber-100 text-amber-800'
                            : item.status === 'reserved'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.status === 'available' && <ShieldCheck size={11} />}
                        {item.status === 'damaged' && <AlertTriangle size={11} />}
                        {item.status === 'available'
                          ? 'พร้อมใช้งาน'
                          : item.status === 'borrowed'
                          ? 'กำลังยืม'
                          : item.status === 'reserved'
                          ? 'รอรับอุปกรณ์'
                          : 'ชำรุด (Damaged)'}
                      </span>
                    </div>
                  </div>

                  <div>
                    {item.status === 'borrowed' || item.status === 'reserved' ? (
                      <span className="text-[10px] text-gray-400 font-bold px-2 py-1">
                        กำลังใช้งาน
                      </span>
                    ) : item.status === 'damaged' ? (
                      <button
                        type="button"
                        onClick={() => void handleToggleStatus(item)}
                        disabled={processingId === item.id}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl cursor-pointer inline-flex items-center gap-1 shadow-xs"
                      >
                        {processingId === item.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Wrench size={12} />
                        )}
                        ซ่อมเสร็จแล้ว
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleToggleStatus(item)}
                        disabled={processingId === item.id}
                        className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 disabled:opacity-50 text-[11px] font-bold px-3 py-1.5 rounded-xl cursor-pointer inline-flex items-center gap-1"
                      >
                        {processingId === item.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <AlertTriangle size={12} />
                        )}
                        แจ้งชำรุด
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Note */}
          <div className="pt-3 border-t border-gray-100 text-[10px] text-gray-400 flex items-center justify-between">
            <span>* การเปลี่ยนสถานะชำรุดจะตัดยอดพร้อมใช้งานในคลังออกอัตโนมัติ</span>
            <button
              onClick={onClose}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-4 py-1.5 rounded-xl text-xs cursor-pointer"
            >
              ปิด
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
