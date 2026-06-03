# Templates email Auth (Supabase)

Emails transactionnels d'**authentification** envoyés par Supabase Auth (≠ emails
applicatifs de compte-rendu qui passent par Resend via `_shared/email.ts`).

Ces fichiers sont la **source de vérité versionnée**. Supabase ne lit pas ces
fichiers automatiquement : il faut les **copier-coller** dans le dashboard à
chaque modification.

## Où coller

Dashboard → **Authentication → Emails** → onglet correspondant → champ *Message body*.

| Fichier | Onglet Supabase | Objet (Subject) suggéré |
|---|---|---|
| [confirm-signup.html](confirm-signup.html) | Confirm signup | Confirmez votre inscription à Aicoute |
| [reset-password.html](reset-password.html) | Reset Password | Réinitialisation de votre mot de passe Aicoute |
| [magic-link.html](magic-link.html) | Magic Link | Votre lien de connexion Aicoute |
| [invite.html](invite.html) | Invite user | Vous êtes invité·e sur Aicoute |
| [change-email.html](change-email.html) | Change Email Address | Confirmez votre nouvelle adresse email |

## Variables Supabase

Tous utilisent `{{ .ConfirmationURL }}` (lien d'action officiel). Autres variables
disponibles si besoin : `{{ .Token }}`, `{{ .TokenHash }}`, `{{ .SiteURL }}`,
`{{ .Email }}`, `{{ .RedirectTo }}`, `{{ .NewEmail }}` (change-email).

## Notes de rendu

- Charte « cocon familial » alignée sur `_shared/email.ts` (bandeau terracotta
  `#C75D3A`, carte crème, Fraunces + Inter).
- Polices custom chargées via Google Fonts mais **fallbacks** Georgia / Arial
  prévus (Gmail/Outlook ignorent souvent `<link>` de polices).
- Vérifier dans Supabase que **« Confirm email »** est activé (sinon le mail de
  confirmation n'est pas envoyé) et que les **URLs de redirection** incluent
  `app.aicoute.fr` (Auth → URL Configuration).
