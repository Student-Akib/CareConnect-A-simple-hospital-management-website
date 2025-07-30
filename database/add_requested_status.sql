-- Add 'requested' status to appointment_status enum
-- This allows patients to request appointments that need receptionist confirmation

ALTER TYPE public.appointment_status ADD VALUE 'requested' BEFORE 'scheduled'; 