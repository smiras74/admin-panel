# Guide du Détour — Admin Panel

## Паспорт проекта v2.0

**URL:** https://admin-panel-orcin-one.vercel.app  
**Репозиторий:** https://github.com/smiras74/admin-panel  
**Стек:** Next.js 14, TypeScript, Tailwind CSS, Firebase  
**Хостинг:** Vercel  

---

## 📁 Структура проекта

```
guide-du-detour-admin/
├── app/
│   ├── api/
│   │   ├── auth/verify/route.ts    # Верификация токена пользователя
│   │   ├── moderation/route.ts     # API модерации (POI, edits, reviews)
│   │   ├── pois/
│   │   │   ├── route.ts            # GET POIs с пагинацией и фильтрами
│   │   │   ├── update/route.ts     # POST обновление POI
│   │   │   ├── enrich/route.ts     # POST обогащение через Wikipedia
│   │   │   └── enrich-ai/route.ts  # POST обогащение через Groq AI
│   │   ├── upload/route.ts         # POST загрузка фото в Firebase Storage
│   │   ├── stats/route.ts          # GET статистика для Dashboard
│   │   ├── users/route.ts          # GET список пользователей
│   │   └── waitlist/route.ts       # GET/DELETE waitlist
│   ├── login/page.tsx              # Страница входа
│   ├── moderation/page.tsx         # Модерация контента
│   ├── pois/page.tsx               # Управление POI
│   ├── users/page.tsx              # Список пользователей
│   ├── waitlist/page.tsx           # Waitlist с экспортом
│   ├── page.tsx                    # Dashboard
│   ├── layout.tsx                  # Корневой layout
│   └── globals.css                 # Глобальные стили
├── components/
│   ├── Navigation.tsx              # Боковая навигация
│   └── StatCard.tsx                # Карточка статистики
├── lib/
│   ├── firebase-admin.ts           # Firebase Admin SDK (server)
│   ├── firebase-client.ts          # Firebase Client SDK (browser)
│   └── auth-context.tsx            # React контекст авторизации
├── types/
│   └── index.ts                    # TypeScript типы
├── .env.local                      # Переменные окружения (НЕ в git)
├── .env.local.example              # Пример переменных
├── next.config.js                  # Конфигурация Next.js
├── tailwind.config.js              # Конфигурация Tailwind
├── tsconfig.json                   # Конфигурация TypeScript
└── package.json                    # Зависимости
```

---

## 🔐 Переменные окружения (.env.local)

```bash
# Firebase Admin SDK (Server-side)
FIREBASE_PROJECT_ID=guide-du-detour
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@guide-du-detour.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Firebase Client SDK (Client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=guide-du-detour.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=guide-du-detour
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=guide-du-detour.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=182479723840
NEXT_PUBLIC_FIREBASE_APP_ID=1:182479723840:web:...

# Groq API (для AI обогащения)
GROQ_API_KEY=gsk_...
```

**Важно:** 
- `FIREBASE_PRIVATE_KEY` должен быть с кавычками и `\n` для переносов строк
- Все переменные нужно добавить в Vercel → Settings → Environment Variables

---

## 📊 Функционал

### Dashboard (/)
- Общая статистика: POI, пользователи, waitlist, модерация
- Быстрые действия для перехода к разделам
- Данные из `/api/stats`

### POIs (/pois)
- **Таблица POI** с пагинацией (50 на страницу)
- **Фильтры:** источник (все/verified/osm), категория, поиск
- **Сортировка:** по имени, дате
- **Модальное окно редактирования:**
  - Название, категория, подкатегория
  - Описание с кнопками обогащения
  - Horaires d'ouverture (часы работы)
  - Фото: просмотр, добавление по URL, загрузка с компьютера
  - Удаление POI

### Обогащение контента
- **Wikipedia:** `/api/pois/enrich` — поиск статьи Wikipedia по названию POI
- **AI (Groq):** `/api/pois/enrich-ai` — генерация описания через Llama 3
- **Copier prompt:** копирование промпта для ручного использования в ChatGPT/Claude

### Загрузка фото (/api/upload)
- Принимает файлы: JPEG, PNG, WebP, GIF, HEIC
- **Автоматическое сжатие через Sharp:**
  - Максимум 1920×1920 px
  - Качество JPEG 80%
  - Автоповорот по EXIF
- Загрузка в Firebase Storage: `poi_photos/{poiId}_{timestamp}.jpg`
- Возвращает публичный URL

### Modération (/moderation)
- **Три вкладки:** Nouveaux POI, Modifications, Commentaires
- Approve/Reject для каждого элемента
- Данные из коллекций: `new_pois`, `pending_edits`, `pending_reviews`

### Waitlist (/waitlist)
- Список email адресов в ожидании
- **Экспорт:** копирование всех email, CSV, формат KissKissBankBank
- Удаление отдельных записей

### Utilisateurs (/users)
- Список зарегистрированных пользователей
- Email, дата регистрации, роль

---

## 🗄️ Firebase структура

### Firestore коллекции

```
users/                      # Пользователи
  {odid}/
    email: string
    role: "user" | "admin"
    createdAt: timestamp

verified_pois/              # Верифицированные POI (13 записей)
  {odid}/
    name: string
    description?: string
    category?: string
    subcategory?: string
    latitude: number
    longitude: number
    photoUrls?: string[]
    openingHours?: string
    source: "admin" | "user" | "osm"
    lastUpdated: timestamp

osm_pois/                   # POI из OpenStreetMap (24000+ записей)
  {osmId}/
    name: string
    latitude: number
    longitude: number
    category?: string
    tags?: object

waitlist/                   # Email waitlist
  {odid}/
    email: string
    createdAt: timestamp

new_pois/                   # Новые POI на модерацию
pending_edits/              # Правки на модерацию
pending_reviews/            # Отзывы на модерацию
```

### Firebase Storage

```
poi_photos/                 # Фото POI
  {poiId}_{timestamp}.jpg

avatars/                    # Аватары пользователей
submissions/                # Загрузки пользователей
```

---

## 🚀 Локальная разработка

### Установка

```bash
cd ~/Downloads/guide-du-detour-admin
npm install
```

### Запуск

```bash
npm run dev
# Откроется http://localhost:3000
```

### Деплой

```bash
git add .
git commit -m "Описание изменений"
git push
# Vercel автоматически задеплоит
```

---

## 🔧 Добавление нового функционала

### Новая страница

1. Создай файл `app/new-page/page.tsx`
2. Добавь `'use client';` в начало для клиентских компонентов
3. Используй `useAuth()` для проверки авторизации
4. Добавь ссылку в `components/Navigation.tsx`

### Новый API endpoint

1. Создай файл `app/api/endpoint/route.ts`
2. Экспортируй функции `GET`, `POST`, `PUT`, `DELETE`
3. Используй `getFirebaseAdmin()` для доступа к Firestore

Пример:
```typescript
import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export async function GET() {
  const { db } = getFirebaseAdmin();
  const snapshot = await db.collection('collection').get();
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json(data);
}
```

### Новая подкатегория POI

В файле `app/pois/page.tsx` найди `SUBCATEGORIES` и добавь:

```typescript
const SUBCATEGORIES: Record<string, string[]> = {
  hedonisme: ['gastronomie', 'restaurants', ..., 'new-subcategory'],
  // ...
};
```

---

## 📱 Категории и подкатегории

```typescript
const CATEGORIES = [
  'histoire', 'nature', 'panorama', 
  'architecture', 'art', 'hedonisme', 
  'insolite', 'curiosites'
];

const SUBCATEGORIES = {
  histoire: ['monuments', 'chateaux', 'eglises', 'musees', 'sites-historiques', 'ruines', 'memorial', 'archeologie'],
  nature: ['parcs', 'jardins', 'forets', 'lacs', 'cascades', 'grottes', 'reserves', 'points-de-vue', 'fermes'],
  hedonisme: ['gastronomie', 'restaurants', 'cafes', 'bars', 'vins', 'vignobles', 'marches', 'spas', 'plages', 'brasseries', 'fromageries', 'brocantes', 'aires-de-repos', 'chambres-dhotes'],
  insolite: ['street-art', 'lieux-abandonnes', 'curiosites', 'ovni', 'mystere'],
  panorama: ['points-de-vue', 'belvederes', 'tours', 'collines'],
  architecture: ['moderne', 'classique', 'art-deco', 'contemporain', 'religieux', 'industriel'],
  art: ['galeries', 'sculptures', 'fresques', 'land-art', 'musees'],
  curiosites: ['insolite', 'mystere', 'legende', 'paranormal'],
};
```

---

## ⚠️ Известные ограничения

1. **Мобильная версия** — некоторые элементы требуют доработки (кнопки в Waitlist, вкладки в Modération)
2. **OSM POI** — только для чтения, редактирование создаёт копию в `verified_pois`
3. **AI обогащение** — зависит от доступности Groq API
4. **Загрузка фото** — максимум один файл за раз через drag-and-drop

---

## 🔗 Связанные ресурсы

- **iOS приложение:** Guide du Détour (Xcode проект)
- **Landing page:** https://guide-du-detour.fr
- **Firebase Console:** https://console.firebase.google.com/project/guide-du-detour
- **Vercel Dashboard:** https://vercel.com/smiras74s-projects/admin-panel

---

## 📝 История версий

### v2.0 (Декабрь 2024)
- Полный редизайн на Next.js 14
- Модальное окно редактирования POI
- Загрузка фото с автосжатием (Sharp)
- AI обогащение через Groq
- Поле "Horaires d'ouverture"
- Выбор подкатегорий
- Кнопка "Copier prompt"

### v1.0 (Декабрь 2024)
- Первая версия на Vite + React
- Базовый Dashboard и списки
