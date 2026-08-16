# Changelog CPREY DRAW

## V1.3.1

- Panneau Propriétés Pieuvre élargi à 480 px.
- Suppression du scroll horizontal dans le panneau Pieuvre.
- Repères des appareillages contextualisés par pieuvre.
- Synchronisation automatique du repère avec le code de sortie simple.
- Exemple : Cuisine 01 / PR3 → appareillage PR3.
- Les mêmes repères peuvent exister sur plusieurs pieuvres.
- Codes composés conservés sans interprétation arbitraire.
- Undo/Redo cohérent sur la synchronisation des repères.
- 121 tests verts.
- Build production vert.

## V1.3

- Personnalisation des sorties libres par projet.
- Ajout de outputOverrides sur les instances de pieuvres.
- Résolution centralisée des sorties effectives.
- Génération automatique des codes par TYPE.
- Configuration diamètre, longueur, couleur et conducteurs.
- Snapshot des sorties personnalisées dans les gaines.
- Blocage de modification lorsqu'une sortie est déjà raccordée.
- Sauvegarde/restauration et Undo/Redo.

## V1.2

- Généralisation de Duct avec endpoints génériques.
- Pieuvre → appareillage.
- Appareillage → appareillage.
- Tableau → appareillage direct.
- CircuitOrigin.
- Plaque cuisson directe : gaine Ø25 et conducteurs 6 mm².
- Calque Câbles directs.
- Visibilité hiérarchique étendue aux chaînes.

## V1.1

- Gaines éditables par courbes quadratiques de Bézier.
- Waypoints réels.
- Points de contrôle par portion.
- Calcul de longueur des courbes.
- Migration des anciens projets.

## V1.0

- Premier moteur de courbes réalistes des gaines.
- Calcul de longueur tenant compte du cheminement.
