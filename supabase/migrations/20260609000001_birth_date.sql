-- Date de naissance complète (pour souhaiter les anniversaires).
-- On garde `birth_year` (tenu à jour par l'UI à partir de birth_date) pour ne pas
-- toucher au calcul d'âge des Edge Functions / du prompt système. birth_date reste
-- NULL pour les bénéficiaires existants (on ne connaît pas leur jour/mois) → l'âge
-- retombe sur birth_year tant que la date n'est pas renseignée.
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS birth_date DATE;
