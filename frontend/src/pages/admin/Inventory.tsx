/**
 * หน้าจัดการคลังอุปกรณ์กีฬาสำหรับเจ้าหน้าที่ (แสดงตารางสต็อก, เพิ่ม, แก้ไข และลบอุปกรณ์)
 */
// src/pages/Admin/Inventory.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { inventoryStyles as styles } from './Inventory.styles';
import { Package, Plus, Pencil, Trash2, CheckCircle2, AlertCircle, Loader2, ListTree } from 'lucide-react';
import { motion } from 'framer-motion';
import InventoryModal, { type InventoryItem } from './components/InventoryModal';
import SerialItemsModal from './components/SerialItemsModal';
import {
  formatEquipCode,
  listEquipment,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  type EquipmentItem,
} from '../../services/equipService';

const SCENIC_MEADOW_BG =
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1920&auto=format&fit=crop';

// ดึงข้อความ Error จาก Axios Response หรือใช้ข้อความสำรอง
function getErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string }>(err)) {
    return err.response?.data?.message || fallback;
  }
  return fallback;
}

// แปลงข้อมูลอุปกรณ์จาก API ให้ตรงกับโครงสร้างตารางและ Modal ของหน้า Inventory
function toInventoryItem(e: EquipmentItem): InventoryItem {
  return {
    id: e.id,
    name: e.name,
    category: e.category || 'อื่นๆ',
    description: e.description || undefined,
    image: e.image || undefined,
    totalQty: e.totalQty ?? e.total,
    availableQty: e.availableQty ?? e.available,
    status: (e.status === 'พร้อมใช้งาน' || e.status === 'ใช้งานอยู่' || e.status === 'ชำรุด/ซ่อมบำรุง')
      ? e.status
      : 'พร้อมใช้งาน',
  };
}

// คอมโพเนนต์หน้าจัดการคลังอุปกรณ์กีฬาของเจ้าหน้าที่
export default function Inventory() {
  const navigate = useNavigate();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [serialModalEquip, setSerialModalEquip] = useState<InventoryItem | null>(null);

  // โหลดรายการอุปกรณ์ทั้งหมดจาก API ใหม่
  const fetchItems = useCallback(async () => {
    try {
      setError(null);
      const data = await listEquipment();
      setItems(data.map(toInventoryItem));
    } catch (err) {
      setError(getErrorMessage(err, 'ไม่สามารถโหลดรายการอุปกรณ์ได้'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    listEquipment()
      .then((data) => {
        if (active) {
          setError(null);
          setItems(data.map(toInventoryItem));
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(getErrorMessage(err, 'ไม่สามารถโหลดรายการอุปกรณ์ได้'));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // บันทึกการเพิ่มหรือแก้ไขอุปกรณ์
  const handleSaveItem = async (itemData: Omit<InventoryItem, 'id'>) => {
    try {
      if (editingItem) {
        const updated = await updateEquipment(editingItem.id, {
          name: itemData.name,
          category: itemData.category,
          description: itemData.description,
          image: itemData.image,
          totalQty: itemData.totalQty,
          availableQty: itemData.availableQty,
          status: itemData.status,
        });
        setItems((prev) =>
          prev.map((item) => (item.id === editingItem.id ? toInventoryItem(updated) : item))
        );
      } else {
        const created = await createEquipment({
          name: itemData.name,
          category: itemData.category,
          description: itemData.description,
          image: itemData.image,
          totalQty: itemData.totalQty,
          availableQty: itemData.availableQty,
          status: itemData.status,
        });
        setItems((prev) => [toInventoryItem(created), ...prev]);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert(getErrorMessage(err, 'ไม่สามารถบันทึกข้อมูลได้'));
    }
  };

  // ลบอุปกรณ์
  const handleDeleteItem = async (id: number) => {
    if (confirm('คุณต้องการลบรายการอุปกรณ์นี้ใช่หรือไม่?')) {
      try {
        await deleteEquipment(id);
        setItems((prev) => prev.filter((item) => item.id !== id));
      } catch (err) {
        alert(getErrorMessage(err, 'ไม่สามารถลบอุปกรณ์ได้'));
      }
    }
  };

  return (
    <div
      className={styles.container}
      style={{ backgroundImage: `url('${SCENIC_MEADOW_BG}')` }}
    >
      <div className="fixed inset-0 bg-gradient-to-b from-sky-900/15 via-emerald-950/10 to-emerald-950/35 pointer-events-none z-0" />

      <div className={styles.contentWrapper}>
        {/* Floating Capsule Navbar */}
        <motion.div
          className="flex items-center justify-between bg-white/75 backdrop-blur-2xl backdrop-saturate-150 px-4 py-2 rounded-full shadow-xl border border-white/80 mb-5 gap-3"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className={styles.leftGroup}>
            <div className={styles.avatarCircle}>A</div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold text-gray-800 leading-tight">เจ้าหน้าที่ผู้ดูแลระบบ</p>
              <p className="text-[10px] text-emerald-700 font-bold">Admin System</p>
            </div>
          </div>

          <div className={styles.rightGroup}>
            <div className={styles.switcherContainer}>
              <button onClick={() => navigate('/admin')} className={`${styles.switcherBtn} ${styles.switcherInactive}`}>
                Dashboard
              </button>
              <button onClick={() => navigate('/admin/inventory')} className={`${styles.switcherBtn} ${styles.switcherActive}`}>
                Inventory
              </button>
              <button onClick={() => navigate('/admin/borrow-logs')} className={`${styles.switcherBtn} ${styles.switcherInactive}`}>
                Logs
              </button>
            </div>
          </div>
        </motion.div>

        {/* Main Content Card */}
        <motion.div
          className="bg-white/80 backdrop-blur-2xl backdrop-saturate-150 rounded-[2.2rem] p-5 sm:p-7 shadow-[0_20px_50px_rgba(15,23,42,0.16)] border border-white/85"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className={styles.headerSection}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-emerald-100 text-emerald-800 p-1.5 rounded-lg">
                  <Package size={18} />
                </div>
                <h1 className="text-lg sm:text-xl font-black text-emerald-950">จัดการคลังอุปกรณ์กีฬา</h1>
              </div>
              <p className="text-gray-500 text-xs">เพิ่ม แก้ไข หรือตรวจสอบสถานะสต็อกอุปกรณ์กีฬาทั้งหมดในระบบ</p>
            </div>

            <button
              onClick={() => {
                setEditingItem(null);
                setIsModalOpen(true);
              }}
              className={styles.addBtn}
            >
              <Plus size={15} /> เพิ่มอุปกรณ์ใหม่
            </button>
          </div>

          {/* Loading / Error / Table */}
          {loading ? (
            <div className="text-center py-16">
              <Loader2 size={32} className="animate-spin text-emerald-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500">กำลังโหลดข้อมูล...</p>
            </div>
          ) : error ? (
            <div className="text-center py-16 text-red-500">
              <AlertCircle size={32} className="mx-auto mb-2" />
              <p className="text-xs font-bold">{error}</p>
              <button
                onClick={() => {
                  setLoading(true);
                  void fetchItems();
                }}
                className="mt-3 text-xs text-emerald-600 font-bold hover:underline cursor-pointer"
              >
                ลองใหม่
              </button>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>รหัส</th>
                    <th className={styles.th}>ชื่ออุปกรณ์</th>
                    <th className={styles.th}>หมวดหมู่</th>
                    <th className={styles.th}>จำนวนทั้งหมด</th>
                    <th className={styles.th}>คงเหลือ</th>
                    <th className={styles.th}>สถานะ</th>
                    <th className={`${styles.th} text-right`}>จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-emerald-50/40 transition-colors">
                      <td className={`${styles.td} font-mono font-bold text-emerald-900`}>
                        {formatEquipCode(item.id)}
                      </td>
                      <td className={`${styles.td} font-bold text-gray-900`}>
                        <div className="flex items-center gap-2.5">
                          {item.image && (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-9 h-9 rounded-xl object-cover border border-gray-200 shrink-0"
                            />
                          )}
                          <div>
                            <p>{item.name}</p>
                            {item.description && (
                              <p className="text-[10px] text-gray-400 font-normal truncate max-w-[220px]">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={styles.td}>
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md text-[11px]">{item.category}</span>
                      </td>
                      <td className={styles.td}>{item.totalQty} ชิ้น</td>
                      <td className={styles.td}>
                        <span className={`font-bold ${item.availableQty > 0 ? 'text-emerald-700' : 'text-red-500'}`}>
                          {item.availableQty} ชิ้น
                        </span>
                      </td>
                      <td className={styles.td}>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === 'พร้อมใช้งาน'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'ใช้งานอยู่'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {item.status === 'พร้อมใช้งาน' ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                          {item.status}
                        </span>
                      </td>
                      <td className={`${styles.td} text-right`}>
                        <button
                          onClick={() => setSerialModalEquip(item)}
                          className={`${styles.actionIconBtn} text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 mr-1`}
                          title="จัดการรหัสประจำชิ้น (Asset Serials)"
                        >
                          <ListTree size={15} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setIsModalOpen(true);
                          }}
                          className={`${styles.actionIconBtn} text-blue-600 hover:text-blue-800`}
                          title="แก้ไขข้อมูล"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className={`${styles.actionIconBtn} text-red-500 hover:text-red-700`}
                          title="ลบอุปกรณ์"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-400 text-xs">
                        ยังไม่มีอุปกรณ์ในระบบ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Modal เพิ่ม / แก้ไข อุปกรณ์ */}
        <InventoryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          editingItem={editingItem}
          onSave={handleSaveItem}
        />

        {/* Modal จัดการรหัสประจำชิ้นและการแจ้งชำรุด */}
        <SerialItemsModal
          isOpen={Boolean(serialModalEquip)}
          onClose={() => setSerialModalEquip(null)}
          equipment={serialModalEquip}
          onEquipmentUpdated={(updated) => {
            setItems((prev) =>
              prev.map((i) => (i.id === updated.id ? toInventoryItem(updated) : i))
            );
          }}
        />
      </div>
    </div>
  );
}
