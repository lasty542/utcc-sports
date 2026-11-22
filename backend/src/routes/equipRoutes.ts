/**
 * กำหนดเส้นทาง API สำหรับดูรายการและจัดการคลังอุปกรณ์กีฬา (Admin เพิ่ม/แก้ไข/ลบ)
 */
import { Router } from 'express';
import {
  createEquipment,
  deleteEquipment,
  getEquipment,
  listEquipment,
  updateEquipment,
} from '../controllers/equipController';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', listEquipment);
router.get('/:id', getEquipment);
router.post('/', authMiddleware, requireRole('admin'), createEquipment);
router.put('/:id', authMiddleware, requireRole('admin'), updateEquipment);
router.delete('/:id', authMiddleware, requireRole('admin'), deleteEquipment);

export default router;
