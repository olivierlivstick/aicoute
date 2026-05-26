-- Seed data pour le développement local MODECT
-- NE PAS exécuter en production

-- Exemple d'aidant (l'auth.users correspondant doit exister)
-- Les profils sont créés automatiquement via le trigger handle_new_user()

-- Exemple de bénéficiaire (à décommenter après avoir créé un compte aidant)
/*
INSERT INTO beneficiaries (
  caregiver_id,
  first_name,
  last_name,
  birth_year,
  gender,
  family_history,
  life_story,
  hobbies,
  favorite_topics,
  topics_to_avoid,
  personality_notes,
  ai_voice,
  ai_persona_name,
  conversation_style,
  onboarding_completed
) VALUES (
  'REMPLACER_PAR_UUID_AIDANT',
  'Jeanne',
  'Dupont',
  1942,
  'female',
  'A deux fils : Pierre (55 ans) et Marc (52 ans). Quatre petits-enfants.',
  'Institutrice à la retraite depuis 1997. A vécu à Lyon puis Nice. Aime la Provence.',
  'Jardinage, tricot, émissions de cuisine, mots croisés',
  'Jardinage, souvenirs de ses années d''enseignement, ses petits-enfants, la cuisine provençale',
  'Politique, nouvelles anxiogènes, sujets médicaux détaillés',
  'Chaleureuse, un peu nostalgique, aime rire. Parle beaucoup de ses petits-enfants.',
  'nova',
  'Marie',
  'warm',
  TRUE
);
*/
