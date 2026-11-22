/**
 * หน้าจัดการคลังอุปกรณ์กีฬาสำหรับเจ้าหน้าที่ (แสดงตารางสต็อก, เพิ่ม, แก้ไข และลบอุปกรณ์)
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { inventoryStyles as styles } from './Inventory.styles';
import { Package, Plus, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import InventoryModal, { type InventoryItem } from './components/InventoryModal';
import SerialItemsModal from './components/SerialItemsModal';
import InventoryTable from './components/InventoryTable';
import {
  listEquipment,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  consolidateEquipment,
  type EquipmentItem,
} from '../../services/equipService';

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
  const [isConsolidating, setIsConsolidating] = useState(false);

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

  // ยุบรวมและจัดระเบียบคลังอุปกรณ์ให้มีเฉพาะ 5 รายการหลักมาตรฐาน
  const handleConsolidate = async () => {
    if (confirm('คุณต้องการจัดระเบียบคลังอุปกรณ์ให้มีเฉพาะ 5 รายการหลัก (เหมือน Localhost) ใช่หรือไม่?')) {
      try {
        setIsConsolidating(true);
        await consolidateEquipment();
        await fetchItems();
        alert('จัดระเบียบและซิงก์คลังอุปกรณ์ 5 รายการหลักเรียบร้อยแล้ว');
      } catch (err) {
        alert(getErrorMessage(err, 'ไม่สามารถจัดระเบียบอุปกรณ์ได้'));
      } finally {
        setIsConsolidating(false);
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.bgImageOverlay} />

      <div className={styles.contentWrapper}>
        {/* Floating Capsule Navbar */}
        <motion.div
          className={styles.topBarContainer}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className={styles.leftGroup}>
            <div className={styles.avatarCircle}>A</div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold text-white leading-tight">เจ้าหน้าที่ผู้ดูแลระบบ</p>
              <p className="text-[10px] text-emerald-400 font-bold">Admin System</p>
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

            <div className="flex items-center gap-2">
              <button
                onClick={() => void handleConsolidate()}
                disabled={isConsolidating}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                title="ยุบรวมและจัดระเบียบอุปกรณ์ให้มีเฉพาะ 5 รายการหลักมาตรฐานเหมือน Localhost"
              >
                <Sparkles size={14} className={isConsolidating ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">จัดระเบียบ 5 รายการหลัก</span>
                <span className="sm:hidden">จัดระเบียบ</span>
              </button>
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
            <InventoryTable
              items={items}
              onEditItem={(item) => {
                setEditingItem(item);
                setIsModalOpen(true);
              }}
              onDeleteItem={handleDeleteItem}
              onManageSerials={(item) => setSerialModalEquip(item)}
            />
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
