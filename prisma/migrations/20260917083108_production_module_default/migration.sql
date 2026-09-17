-- AlterTable
ALTER TABLE "ShopSettings" ALTER COLUMN "modules" SET DEFAULT ARRAY['vehicles', 'customers', 'workOrders', 'schedule', 'estimates', 'invoices', 'parts', 'technicians', 'inspections', 'reports', 'payments', 'ai', 'production', 'messages', 'notifications']::TEXT[];
