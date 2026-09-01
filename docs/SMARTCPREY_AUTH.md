# Intégration SmartCPREY de CPREY DRAW

Ce dépôt contient l'application frontend CPREY DRAW. Il ne contient pas le code serveur SmartCPREY (`/profils`, `/configurateur`, `/configurateur_LM`) ni le schéma de base de données production. Les fichiers PHP réels doivent donc être modifiés dans le dépôt ou webroot SmartCPREY après audit de leur mécanisme existant.

## Objectif V1.9.0

CPREY DRAW doit être servi sous l'URL canonique :

`https://www.smartcprey.com/CPREY-DRAW/`

L'accès doit être contrôlé côté serveur :

- utilisateur non connecté : redirection vers le login SmartCPREY ou réponse 401 pour les API ;
- utilisateur connecté sans droit CPREY DRAW : page 403 propre ou réponse JSON 403 ;
- utilisateur autorisé ou administrateur : accès autorisé.

Le frontend ne doit jamais être la source d'autorité du droit d'accès.

## Identifiant Applicatif

Identifiant technique retenu :

`cprey_draw`

Libellé utilisateur :

`CPREY DRAW`

Description portail :

`Conception et implantation des installations CPREYCONNECT.`

## Build Frontend

Le build Vite utilise `/CPREY-DRAW/` comme `base` en production. Les assets générés doivent donc être référencés sous :

`/CPREY-DRAW/assets/...`

Pour un build local spécifique, il est possible de surcharger :

```bash
VITE_BASE_PATH=/CPREY-DRAW-test/ npm run build
```

En développement, `npm run dev` conserve une base `/`.

## Session Frontend

CPREY DRAW interroge au démarrage :

`GET /CPREY-DRAW/api/session.php`

Réponse attendue pour un utilisateur autorisé :

```json
{
  "authenticated": true,
  "user": {
    "id": 123,
    "email": "client@example.com",
    "isAdmin": false
  },
  "applications": {
    "cpreyDraw": true
  }
}
```

L'endpoint doit répondre avec :

- `401` si aucune session SmartCPREY valide n'existe ;
- `403` si la session existe mais ne possède pas le droit `cprey_draw` ;
- `200` si le droit est accordé ou si l'utilisateur est administrateur.

Ajouter `Cache-Control: no-store` sur cette route.

## Développement Local

Le frontend fournit un mock de session uniquement en mode dev Vite. Il n'est pas activable en production :

- dev par défaut : session locale `dev@smartcprey.local` ;
- dev désactivé explicitement : `VITE_SMARTCPREY_AUTH_MOCK=false npm run dev` ;
- production : aucune session mock.

Ce mock ne doit jamais être utilisé comme mécanisme serveur.

## Point D'entrée Serveur Recommandé

Le répertoire déployé doit empêcher l'accès direct à `index.html`. Une organisation simple :

```text
/CPREY-DRAW/
  index.php
  api/
    session.php
  assets/
  ...
```

`index.php` doit :

1. charger le bootstrap SmartCPREY existant ;
2. démarrer/réutiliser la session existante ;
3. obtenir l'utilisateur courant via une fonction centrale ;
4. vérifier le droit `cprey_draw` via une fonction centrale ;
5. servir le shell HTML de l'application uniquement si l'accès est autorisé.

Les futures API `/CPREY-DRAW/api/projects/...` devront appeler le même garde serveur.

## Fonctions Serveur À Prévoir

Noms conceptuels à adapter au code réel SmartCPREY :

```php
function get_current_smartcprey_user(): ?array;
function user_has_application_access(int $userId, string $applicationKey): bool;
function require_cprey_draw_user(): array;
```

`require_cprey_draw_user()` doit accepter :

- un utilisateur explicitement autorisé à `cprey_draw` ;
- un administrateur SmartCPREY, selon la règle support retenue.

Elle doit refuser toute autre session.

## Administration

Dans `/profils/admin/`, ajouter le droit CPREY DRAW dans l'écran existant de modification/création de compte, en réutilisant le modèle de droits applicatifs s'il existe.

Règles :

- les comptes existants ne reçoivent pas automatiquement le droit CPREY DRAW ;
- un administrateur peut activer ou révoquer le droit ;
- la révocation doit être effective dès la requête suivante ;
- toute écriture admin doit refaire le contrôle admin côté serveur ;
- utiliser les protections CSRF existantes si elles existent.

## Portail Applications

Dans `/profils/admin/recap_applications.php`, ajouter CPREY DRAW dans le style existant :

- nom : `CPREY DRAW` ;
- URL : `https://www.smartcprey.com/CPREY-DRAW/` ;
- description : `Conception et implantation des installations CPREYCONNECT.`

Dans la section "Quand utiliser quoi ?", ajouter :

`Concevoir une installation électrique : utiliser CPREY DRAW.`

## Base De Données

Si SmartCPREY possède déjà une table générique de droits applicatifs, l'étendre avec l'application `cprey_draw`.

Si aucune table générique n'existe, créer la plus petite migration compatible avec le modèle réel après audit. Ne pas exécuter d'`ALTER TABLE` depuis une page web.

Avant toute migration production :

1. sauvegarder la base de données ;
2. sauvegarder les fichiers PHP modifiés hors webroot public ;
3. appliquer la migration ;
4. tester les trois états : non connecté, connecté sans droit, autorisé/admin.

## Points À Ne Pas Faire En V1.9.0

- stockage Cloud des projets ;
- comptes CPREY DRAW séparés ;
- tokens maison ;
- droits stockés durablement dans le frontend ;
- CORS ouvert en `*` ;
- accès public à `index.html` ;
- répertoire public de fichiers `.cpreydraw`.
