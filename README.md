# XLOGO

Plateforme web éducative pour apprendre XLOGO au collège avec deux espaces :

- **Espace Élève** : éditeur XLOGO, canvas tortue, exécution, indice, solution, correction IA, progression, badges, export PNG.
- **Espace Enseignant** : dashboard, classes, élèves, exercices, affectation, réponses, correction manuelle, export CSV et statistiques.

La plateforme garde uniquement :

- **2ème AC**
- **3ème AC**

Il n’y a plus de 1er AC.

---

## 1. Installation locale

```bash
cd xlogo
npm install
cp .env.example .env
npm start
```

Puis ouvrir :

```text
http://localhost:3000
```

En développement :

```bash
npm run dev
```

---

## 2. Création d’une clé Gemini API

1. Ouvre Google AI Studio.
2. Crée une clé API Gemini.
3. Copie la clé.
4. Colle-la dans le fichier `.env` côté backend uniquement.

Important : la clé ne doit jamais être mise dans `public/app.js`, `index.html` ou le frontend.

---

## 3. Configuration `.env`

Exemple :

```env
PORT=3000
GEMINI_API_KEY=ta_cle_gemini
GEMINI_MODEL=gemini-3.5-flash
TEACHER_NAME=Enseignant
TEACHER_PASSWORD=motdepassefort
TEACHER_TOKEN=token-long-secret
CORS_ORIGIN=*
```

`TEACHER_PASSWORD` sert à se connecter depuis l’interface enseignant.

`TEACHER_TOKEN` sert ensuite à protéger les routes enseignant.

---

## 4. Lancement local

```bash
npm start
```

Si la clé Gemini est absente ou si l’API ne répond pas, la plateforme utilise automatiquement une banque locale d’exercices et une correction locale simple.

---

## 5. Déploiement sur Render.com

Méthode simple :

1. Mets le dossier `xlogo` dans un dépôt GitHub.
2. Va sur Render.
3. Clique sur **New > Web Service**.
4. Connecte ton dépôt GitHub.
5. Build command :

```bash
npm install
```

6. Start command :

```bash
npm start
```

7. Ajoute les variables d’environnement :

```text
GEMINI_API_KEY
GEMINI_MODEL
TEACHER_PASSWORD
TEACHER_TOKEN
TEACHER_NAME
CORS_ORIGIN
NODE_VERSION
```

Tu peux aussi utiliser `render.yaml`, déjà fourni.

Note : le stockage JSON local est simple et fonctionne pour un prototype. Sur Render gratuit, le système de fichiers peut être réinitialisé lors de certains redéploiements. Pour une utilisation longue durée, remplacer les fichiers JSON par SQLite avec disque persistant ou par une vraie base de données.

---

## 6. Routes API principales

### IA

#### `POST /api/generate-exercise`

Entrée :

```json
{
  "level": "2AC",
  "studentName": "Sara",
  "history": []
}
```

Sortie :

```json
{
  "title": "...",
  "description": "...",
  "hint": "...",
  "solution": "..."
}
```

#### `POST /api/evaluate`

Entrée :

```json
{
  "level": "2AC",
  "exercise": {},
  "studentCode": "REPETE 4 [AVANCE 100 DROITE 90]"
}
```

Sortie :

```json
{
  "score": 8,
  "comment": "...",
  "errors": [],
  "improvement": "..."
}
```

### Enseignant

- `POST /api/teacher/login`
- `GET /api/teacher/dashboard`
- `GET /api/students`
- `POST /api/students`
- `DELETE /api/students/:id`
- `GET /api/classes`
- `POST /api/classes`
- `GET /api/exercises`
- `POST /api/exercises`
- `GET /api/submissions`
- `POST /api/submissions`
- `PATCH /api/submissions/:id`
- `GET /api/export/csv`

### Élève

- `POST /api/student/login`
- `GET /api/exercises`
- `GET /api/submissions?studentId=...`
- `POST /api/submissions`

---

## 7. Utiliser l’espace enseignant

1. Clique sur **Enseignant**.
2. Entre le mot de passe défini dans `.env` avec `TEACHER_PASSWORD`.
3. Depuis le dashboard tu peux :
   - voir les élèves ;
   - filtrer par classe, niveau et score ;
   - créer une classe ;
   - ajouter ou supprimer un élève ;
   - créer un exercice ;
   - générer un exercice avec IA ;
   - affecter un exercice à tous, à une classe ou à un élève ;
   - voir les réponses ;
   - corriger manuellement ;
   - exporter les résultats en CSV ;
   - voir les meilleurs élèves et les élèves en difficulté.

---

## 8. Utiliser l’espace élève

1. Clique sur **Élève**.
2. Entre : nom, classe et niveau.
3. Choisis uniquement **2AC** ou **3AC**.
4. Écris ton code XLOGO.
5. Clique sur **Exécuter** pour dessiner.
6. Clique sur **Correction IA** pour recevoir une note /10.
7. Consulte **Progression** pour voir l’historique et les badges.

---

## 9. Commandes XLOGO prises en charge

### 2AC

- `AVANCE n` ou `AV n`
- `RECULE n` ou `RE n`
- `DROITE n` ou `DR n` ou `TD n`
- `GAUCHE n` ou `GA n` ou `TG n`
- `REPETE n [ ... ]`
- `COULEURCRAYON couleur` ou `CC couleur`
- `LEVECRAYON` ou `LC`
- `BAISSECRAYON` ou `BC`

Figures : carré, rectangle, triangle, losange, pentagone, hexagone, spirale, étoile simple.

### 3AC

Toutes les commandes de 2AC avec des exercices plus complexes : rosace, flocon, damier, étoile complexe, figures symétriques, motifs décoratifs, formes composées.

---

## 10. Sécurité

- La clé Gemini reste côté serveur dans `.env`.
- Le frontend appelle uniquement `/api/generate-exercise` et `/api/evaluate`.
- Les routes enseignant utilisent un token backend.
- Les requêtes JSON sont limitées en taille.
- Les niveaux acceptés sont seulement `2AC` et `3AC`.
- Les boucles XLOGO trop grandes sont bloquées côté frontend.

---

## 11. Structure

```text
xlogo/
├── server.js
├── package.json
├── render.yaml
├── .env.example
├── README.md
├── data/
│   ├── users.json
│   ├── classes.json
│   ├── exercises.json
│   └── submissions.json
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```
