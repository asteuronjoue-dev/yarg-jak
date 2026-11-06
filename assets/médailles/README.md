# Médailles YARG

Dossier des badges de progression (8 rangs par catégorie).

Rangs : bronze, argent, or, platine, diamant, maître, grand-maître, champion.

Catégories : guitar, bass, drums, keys, vocals, attendance, stage, library.

Les 8 fichiers `attendance-*.svg` sont déjà présents dans ce dépôt. Les 56 PNG de chant, guitare, basse, batterie, clavier, temps sur scène et demandes spéciales sont livrés dans l'archive à importer. Décompresser l'archive et téléverser ces PNG dans ce dossier.

Nommage : `<category>-<01-08>-<rank>.png`; `attendance` est en `.svg`. Le profil utilise ces chemins. L'icône « Pilier de la scène » est 🤘.

La migration SQL des 3 catégories concernées se trouve sous `sql/2026-11-05-eight-tier-achievements.sql` : exécuter dans Supabase SQL Editor. Ne pas utiliser une migration qui effacerait des titres déjà gagnés.
