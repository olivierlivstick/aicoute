-- Migration : OUVERTURE spécifique aux appels ENTRANTS (Lot 3, volet prompt)
--
-- Quand le bénéficiaire APPELLE AICOUTE (origin='inbound'), la règle d'ouverture
-- du prompt sortant (« Bonjour {{prenom}}, c'est {{persona}} » — sous-entendu
-- c'est l'IA qui appelle) sonne faux. On veut : « {{prenom}}, quel plaisir de
-- t'entendre ! Comment vas-tu ? ».
--
-- La PERSONNALITÉ reste 100% partagée (custom_prompt / prompt_templates.template) :
-- seule l'OUVERTURE diffère. On lui applique la MÊME logique en cascade que le
-- prompt principal :
--   - défaut plateforme éditable (prompt_templates.inbound_opening, /admin/prompt)
--   - snapshot concret par bénéficiaire à la création (beneficiaries.inbound_custom_prompt),
--     éditable + « Réinitialiser depuis le défaut » dans /contexte. NULL → défaut.
--
-- Le bloc d'ouverture est injecté EN DERNIER par le code (buildSystemPrompt), de
-- façon IMPÉRATIVE, donc il prime sur la règle n°1 sortante du template.
--
-- ⚠️ Texte seedé ci-dessous = source de vérité DB. À GARDER EN PHASE avec :
--   - CODE_DEFAULT_INBOUND_OPENING (filet edge, _shared/systemPrompt.ts)
--   - DEFAULT_INBOUND_OPENING (shared, packages/shared/src/promptTemplate.ts)

-- ① Défaut plateforme : nouvelle colonne sur le singleton prompt_templates.
ALTER TABLE prompt_templates ADD COLUMN IF NOT EXISTS inbound_opening TEXT;

UPDATE prompt_templates SET inbound_opening =
$tpl$C'est {{prenom}} qui T'APPELLE — ce n'est pas toi qui l'appelles. Montre une joie sincère et chaleureuse dès le tout premier mot, par exemple : « {{prenom}}, quel plaisir de t'entendre ! Comment vas-tu ? ». Ne dis jamais que c'est toi qui appelles, ni « je t'appelle ». Laisse ensuite {{prenom}} t'expliquer ce qui l'amène, et reste exactement le même compagnon chaleureux que d'habitude.$tpl$
WHERE id = 1 AND inbound_opening IS NULL;

-- Le défaut doit toujours exister (comme `template`). Après le seed du singleton,
-- on impose NOT NULL.
ALTER TABLE prompt_templates ALTER COLUMN inbound_opening SET NOT NULL;

-- ② Surcharge par bénéficiaire : copie concrète de l'ouverture, snapshottée à la
-- création, éditable dans /contexte. NULL = pas de surcharge → on retombe sur le
-- défaut plateforme au moment de l'appel.
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS inbound_custom_prompt TEXT;

COMMENT ON COLUMN prompt_templates.inbound_opening IS 'Ouverture par défaut des appels ENTRANTS (le bénéficiaire appelle). Variables {{prenom}}/{{persona}}/{{il_elle}}… résolues à l''appel. Prime sur la règle d''ouverture du template principal.';
COMMENT ON COLUMN beneficiaries.inbound_custom_prompt IS 'Ouverture concrète (variables résolues) propre au bénéficiaire pour ses appels entrants. NULL → défaut plateforme prompt_templates.inbound_opening.';
