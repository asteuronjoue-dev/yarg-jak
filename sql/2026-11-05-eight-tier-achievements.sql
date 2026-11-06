-- YARG · huit niveaux pour les catégories de progression existantes.
-- À exécuter dans le SQL Editor de Supabase (aucune donnée de joueur effacée).
-- Conserve les codes, noms et seuils de tous les titres déjà présents.
-- Les rangs supplémentaires sont ajoutés seulement jusqu'à huit par catégorie.
DO $yarg$
DECLARE
  c text;
  existing_count integer;
  current_threshold integer;
  new_threshold integer;
  target_threshold integer;
  next_rank integer;
  metric_name text;
  rank_name text;
  group_name text;
  new_code text;
BEGIN
  FOREACH c IN ARRAY ARRAY['attendance','stage','library'] LOOP
    SELECT count(*)::integer, COALESCE(max(threshold),0)::integer,
           (array_agg(metric ORDER BY threshold DESC, sort_order DESC))[1]
      INTO existing_count,current_threshold,metric_name
    FROM public.yarg_title_catalog WHERE category=c;
    metric_name := COALESCE(metric_name,CASE c
      WHEN 'attendance' THEN 'parties'
      WHEN 'stage' THEN 'stage_minutes'
      ELSE 'library_requests' END);
    group_name := CASE c WHEN 'attendance' THEN 'Présence aux soirées'
      WHEN 'stage' THEN 'Temps sur scène' ELSE 'Demandes spéciales' END;
    IF existing_count > 8 THEN
      RAISE NOTICE 'La catégorie % possède déjà % niveaux; elle est laissée intacte.',c,existing_count;
      CONTINUE;
    END IF;
    FOR next_rank IN (existing_count + 1)..8 LOOP
      rank_name := (ARRAY['Bronze','Argent','Or','Platine','Diamant',
                         'Maître','Grand maître','Champion'])[next_rank];
      target_threshold := CASE c
        WHEN 'attendance' THEN (ARRAY[1,2,3,5,8,12,20,30])[next_rank]
        WHEN 'stage' THEN (ARRAY[10,30,60,120,240,480,960,1800])[next_rank]
        ELSE (ARRAY[1,3,5,10,20,35,60,100])[next_rank]
      END;
      new_threshold := GREATEST(target_threshold,current_threshold+1,
                                  CEIL(current_threshold*1.6)::integer);
      new_code := c||'_medal_'||next_rank;
      INSERT INTO public.yarg_title_catalog
        (code,label,category,metric,threshold,sort_order)
      VALUES(new_code,group_name||' — '||rank_name,c,metric_name,new_threshold,
             (SELECT COALESCE(max(sort_order),0)+1 FROM public.yarg_title_catalog))
      ON CONFLICT (code) DO NOTHING;
      current_threshold := new_threshold;
    END LOOP;
    RAISE NOTICE '% : % niveaux au total après migration',c,
      (SELECT count(*) FROM public.yarg_title_catalog WHERE category=c);
  END LOOP;
END
$yarg$;
-- IMPORTANT : yarg_sync_my_titles() est une fonction Supabase existante;
-- l'ouverture d'un profil synchronisera les nouvelles récompenses.
SELECT category,code,label,metric,threshold
FROM public.yarg_title_catalog
WHERE category IN ('attendance','stage','library')
ORDER BY category,threshold,sort_order;
