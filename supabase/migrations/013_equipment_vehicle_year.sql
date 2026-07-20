-- Vehicle make/model year for Fleet + Driver Hub
ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS year INTEGER;

COMMENT ON COLUMN public.equipment.brand IS 'Vehicle make / manufacturer brand';
COMMENT ON COLUMN public.equipment.model IS 'Vehicle or equipment model';
COMMENT ON COLUMN public.equipment.year IS 'Model year for vehicles';
