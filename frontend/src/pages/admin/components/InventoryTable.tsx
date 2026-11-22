import { Pencil, Trash2, CheckCircle2, AlertCircle, ListTree } from 'lucide-react';
import { formatEquipCode } from '../../../services/equipService';
import type { InventoryItem } from './InventoryModal';
import { inventoryStyles as styles } from '../Inventory.styles';

interface InventoryTableProps {
  items: InventoryItem[];
  onEditItem: (item: InventoryItem) => void;
  onDeleteItem: (id: number) => void;
  onManageSerials: (item: InventoryItem) => void;
}

export default function InventoryTable({
  items,
  onEditItem,
  onDeleteItem,
  onManageSerials,
}: InventoryTableProps) {
  return (
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
                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md text-[11px]">
                  {item.category}
                </span>
              </td>
              <td className={styles.td}>{item.totalQty} ชิ้น</td>
              <td className={styles.td}>
                <span
                  className={`font-bold ${
                    item.availableQty > 0 ? 'text-emerald-700' : 'text-red-500'
                  }`}
                >
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
                  {item.status === 'พร้อมใช้งาน' ? (
                    <CheckCircle2 size={11} />
                  ) : (
                    <AlertCircle size={11} />
                  )}
                  {item.status}
                </span>
              </td>
              <td className={`${styles.td} text-right`}>
                <button
                  onClick={() => onManageSerials(item)}
                  className={`${styles.actionIconBtn} text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 mr-1`}
                  title="จัดการรหัสประจำชิ้น (Asset Serials)"
                >
                  <ListTree size={15} />
                </button>
                <button
                  onClick={() => onEditItem(item)}
                  className={`${styles.actionIconBtn} text-blue-600 hover:text-blue-800`}
                  title="แก้ไขข้อมูล"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => onDeleteItem(item.id)}
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
  );
}
