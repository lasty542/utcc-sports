/**
 * กำหนดเส้นทาง API สำหรับดูรายการและจัดการคลังอุปกรณ์กีฬา (Admin เพิ่ม/แก้ไข/ลบ)
 */
import { Router } from 'express';
import {
  createEquipment,
  deleteEquipment,
  getEquipment,
  listEquipment,
  listEquipmentItems,
  updateEquipment,
  updateItemStatus,
} from '../controllers/equipController';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', listEquipment);
router.get('/:id', getEquipment);
router.get('/:id/items', listEquipmentItems);
router.patch('/items/:itemId/status', authMiddleware, requireRole('admin'), updateItemStatus);
router.post('/', authMiddleware, requireRole('admin'), createEquipment);
router.put('/:id', authMiddleware, requireRole('admin'), updateEquipment);
router.delete('/:id', authMiddleware, requireRole('admin'), deleteEquipment);

export default router;
