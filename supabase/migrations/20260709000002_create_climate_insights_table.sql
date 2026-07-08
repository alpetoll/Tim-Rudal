-- Create climate_insights table
CREATE TABLE IF NOT EXISTS public.climate_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lahan_id UUID REFERENCES public.lahan(id) ON DELETE CASCADE NOT NULL,
  avg_precipitation_early_period NUMERIC NOT NULL,
  avg_precipitation_recent_period NUMERIC NOT NULL,
  precipitation_change_percent NUMERIC NOT NULL,
  extreme_heat_days_early_period INTEGER NOT NULL,
  extreme_heat_days_recent_period INTEGER NOT NULL,
  extreme_heat_change_percent NUMERIC NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(lahan_id)
);

-- Enable RLS
ALTER TABLE public.climate_insights ENABLE ROW LEVEL SECURITY;

-- Create policies for climate_insights
DROP POLICY IF EXISTS "Petani dapat mengelola insight iklim lahannya sendiri" ON public.climate_insights;

CREATE POLICY "Petani dapat mengelola insight iklim lahannya sendiri"
ON public.climate_insights
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lahan
    WHERE lahan.id = climate_insights.lahan_id
      AND lahan.petani_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lahan
    WHERE lahan.id = climate_insights.lahan_id
      AND lahan.petani_id = auth.uid()
  )
);
