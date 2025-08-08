**📝 CAHIER DES CHARGES (VERSION SYSTÈME CENTRALISÉ)**

**1\. CONTEXTE ET OBJECTIF DU PROJET**

Créer une plateforme web B2B de distribution alimentaire et agricole centralisée :

- Les vendeurs/fournisseurs (producteurs, centrales, grossistes) approvisionnent un entrepôt centralisé (physique et numérique).
- La plateforme gère l’achat-revente à ses clients B2B (restaurants, hôtels, entreprises).
- Le gestionnaire de stock contrôle toutes les entrées (approvisionnement) et sorties (livraisons).
- Le système intègre un module livraison avec suivi en temps réel.

**2\. PARTIES PRENANTES**

| Partie prenante | Rôle et intervention |
| --- | --- |
| Administrateur | Supervise toute la plateforme, gère utilisateurs, approvisionnements, ventes, paramétrages. |
| Business Developer | Recherche et intègre de nouveaux fournisseurs (producteurs, grossistes, centrales) sur la plateforme, négocie les prix d’achat et quantités. |
| Producteur / Planteur | Fournit des produits agricoles en gros à la plateforme, via dépôt physique en entrepôt (après validation approvisionnement). |
| Grossiste régional / Centrale de vente | Fournit des lots plus importants à l’entrepôt central pour revente. |
| Gestionnaire de stock | Valide la réception physique et enregistre l’approvisionnement dans le système numérique, met à jour l’inventaire. |
| Client B2B | Achète directement à la plateforme (pas aux vendeurs). |
| Livreur | Transporte et livre les commandes aux clients finaux, partage sa position en temps réel. |

**3\. FLUX D’APPROVISIONNEMENT ET VENTE**

1. **Approvisionnement :**
    - Un vendeur (producteur, grossiste, centrale) propose un approvisionnement sur la plateforme :
        - Déclare les produits, quantités, prix proposé, date de livraison prévue.
    - Business developer valide la pertinence et négocie si besoin.
    - Gestionnaire de stock confirme réception physique à l’entrepôt :
        - Vérifie quantité, qualité, conformité.
        - Valide l’entrée dans le stock numérique (Mise à jour inventaire).
2. **Mise en vente :**
    - Une fois validé, le stock est disponible à la vente pour les clients B2B.
    - La plateforme fixe son prix de revente (modèle achat-revente).
3. **Commande client :**
    - Un client B2B passe commande sur la plateforme.
    - Un client décide de se faire livrer ou non.
    - Le stock est décrémenté après validation et paiement.
4. **Livraison :**
    - Le livreur est assigné.
    - La commande est préparée par l’entrepôt et remise au livreur.
    - Suivi en temps réel via GPS Google Maps jusqu’à livraison au client.

**4\. INTERFACES UTILISATEURS**

A. **Fournisseurs (Producteurs, Grossistes, Centrales)**

- Dashboard fournisseur
  - Déclarer un approvisionnement (produit, quantité, prix, date livraison)
  - Voir historique approvisionnements
  - Voir paiements reçus de la plateforme (puisqu’ils vendent à la plateforme)

**B. Gestionnaire de stock**

- Dashboard gestion stock
  - Liste approvisionnements à recevoir
  - Validation réception physique et numérique
  - Gestion inventaire temps réel
  - Validation sorties (commandes clients)
  - Rapports (stock restant, ruptures, approvisionnements récents)

**C. Business Developer**

- Dashboard sourcing
  - Liste fournisseurs intégrés
  - Demandes d’approvisionnement en attente de validation
  - Négociation prix/quantités avant validation
  - Suivi partenaires et performances d’approvisionnement

**D. Clients B2B**

- Dashboard client
  - Consultation catalogue complet
  - Passation commandes
  - Paiement direct ou crédit (si autorisé)
  - Suivi commandes et factures

**E. Livreurs**

- Dashboard livreur
  - Liste des livraisons assignées
  - Statut de chaque livraison
  - Partage position GPS en temps réel pour suivi client

**F. Administrateur**

- Supervision globale de tous les dashboards
- Gestion utilisateurs et rôles
- Gestion transactions financières
- Reporting complet (ventes, approvisionnements, marges)

**5\. POINTS TECHNIQUES CLÉS**

✅ Approvisionnement

- Flux de validation triple : fournisseur → business developer → gestionnaire de stock.
- Entrée stock physique = mise à jour stock numérique après validation qualité et quantité.

✅ Vente

- Vente uniquement depuis l’inventaire plateforme (pas de lien client-vendeur direct).

✅ Livraison

- Module Google Maps API :
  - Suivi en temps réel position livreur.
  - ETA visible pour le client sur son dashboard.
- Assignation manuelle ou algorithmique des livreurs disponibles.

✅ Paiement

- Paiement fournisseur : effectué après validation réception stock.
- Paiement client : à la commande ou à crédit selon conditions validées.

6\. **TECHNOLOGIES ENVISAGÉES**

| Module | Technologie |
| --- | --- |
| Front-end et Back-End | Next.js |
| Base de données | MySQL ou PostgreSQL |
| Tracking temps réel | Google Maps API (livreurs) |
| Notifications | Email, SMS Gateway (Twilio ou autre) |

**7\. DIAGRAMMES À RÉALISER**

- Diagramme de cas d’utilisation UML
  - Représentant chaque rôle et ses interactions
- Diagramme de séquence
  - Pour le flux approvisionnement + validation + vente + livraison
- Modèle conceptuel de données (MCD)
  - Intégrant stock, approvisionnement, livraison, utilisateurs
  