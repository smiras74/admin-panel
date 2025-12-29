# Guide du Détour — Схема базы данных Firebase v2.0

**Дата:** 29 декабря 2025  
**Версия:** 2.0  
**Статус:** Утверждено к внедрению

---

## 📋 Оглавление

1. [Обзор изменений](#обзор-изменений)
2. [Структура коллекций](#структура-коллекций)
   - [users](#users)
   - [pois](#pois)
   - [routes](#routes)
   - [reviews](#reviews)
   - [checkIns](#checkins)
   - [ratings](#ratings)
   - [friendRequests](#friendrequests)
   - [reports](#reports)
   - [waitlist](#waitlist)
   - [coverage](#coverage)
3. [План миграции](#план-миграции)
4. [Приватность и GDPR](#приватность-и-gdpr)

---

## 🔄 Обзор изменений

### Что меняется

| Было | Станет | Причина |
|------|--------|---------|
| `cached_pois` + `verified_pois` | `pois` (единая) | Устранение дублирования |
| `photoURL`, `photoUrl`, `photoUrls` | `photoUrls[]` | Единый формат |
| `"Histoire"` / `"histoire"` | `"histoire"` | Нормализация регистра |
| `totalKm` + `totalKmTraveled` | `stats.kmTraveled` | Устранение дублей |
| Нет избранного | `users/{id}/favorites/` | Новая функция |
| Нет маршрутов | `routes/` | Ключевая функция |
| Нет треков | `routes/{id}/trackPoints/` | Запись GPS |

### Новые коллекции

- `routes/` — маршруты пользователей
- `friendRequests/` — заявки в друзья
- `reports/` — жалобы на контент
- `coverage/` — агрегация треков для тепловой карты

### Новые субколлекции

- `users/{id}/favorites/` — избранные POI
- `users/{id}/viewHistory/` — история просмотров
- `users/{id}/notifications/` — уведомления
- `routes/{id}/trackPoints/` — GPS-трек маршрута

---

## 📁 Структура коллекций

---

### users

**Путь:** `users/{userId}`

**Описание:** Профиль пользователя со всеми настройками, статистикой и gamification.

```typescript
interface User {
  // ══════════════════════════════════════════
  // ИДЕНТИФИКАЦИЯ
  // ══════════════════════════════════════════
  
  id: string;                     // Firebase Auth UID (совпадает с document ID)
  
  // ══════════════════════════════════════════
  // АВТОРИЗАЦИЯ
  // Гибкая структура для разных способов входа.
  // Пользователь может привязать несколько провайдеров.
  // ══════════════════════════════════════════
  
  auth: {
    providers: ('apple' | 'google' | 'email' | 'phone')[];
    appleId?: string;             // Apple Sign In ID
    googleId?: string;            // Google Sign In ID
    email?: string;               // Email (может быть от любого провайдера)
    emailVerified: boolean;
    phone?: string;               // На будущее
  };
  
  // ══════════════════════════════════════════
  // ПРОФИЛЬ
  // Публичная информация о пользователе.
  // ══════════════════════════════════════════
  
  firstName: string;
  lastName: string;
  displayName: string;            // "Имя Фамилия" — для отображения
  avatarUrl?: string;             // URL фото в Firebase Storage
  
  // ══════════════════════════════════════════
  // СОХРАНЁННЫЕ МЕСТА
  // Быстрый доступ к частым точкам назначения.
  // ══════════════════════════════════════════
  
  savedPlaces: {
    home?: {
      name: string;               // "Дом" или своё название
      latitude: number;
      longitude: number;
      address?: string;           // "12 Rue de Paris, Meaux"
    };
    work?: {
      name: string;
      latitude: number;
      longitude: number;
      address?: string;
    };
    custom?: Array<{
      id: string;
      name: string;               // "Дача", "Родители" и т.д.
      latitude: number;
      longitude: number;
      address?: string;
    }>;
  };
  
  // ══════════════════════════════════════════
  // СОЦИАЛЬНОЕ
  // Друзья и блокировки.
  // ══════════════════════════════════════════
  
  friends: string[];              // Массив userId подтверждённых друзей
  blockedUsers: string[];         // Заблокированные пользователи
  
  // ══════════════════════════════════════════
  // СТАТИСТИКА
  // Счётчики действий пользователя.
  // Обновляются через Cloud Functions при модерации.
  // ══════════════════════════════════════════
  
  stats: {
    // Маршруты
    routesCompleted: number;      // Завершённых маршрутов
    kmTraveled: number;           // Километров пройдено
    
    // POI взаимодействие
    poisViewed: number;           // Просмотрено POI
    poisAddedToRoutes: number;    // Добавлено в маршруты
    checkIns: number;             // Чекинов сделано
    
    // Контент (только одобренный модерацией!)
    ratingsGiven: number;         // Оценок поставлено
    reviewsApproved: number;      // Комментариев одобрено
    reviewsPublic: number;        // Из них публичных
    reviewsFriends: number;       // Из них для друзей
    poisCreated: number;          // POI создано и одобрено
    poisEdited: number;           // Правок POI одобрено
    
    // Социальное
    routesShared: number;         // Маршрутов которыми поделился
    routesCopied: number;         // Сколько раз скопировали мои маршруты
  };
  
  // ══════════════════════════════════════════
  // GAMIFICATION
  // Очки, уровни, достижения.
  // ══════════════════════════════════════════
  
  gamification: {
    points: number;               // Текущее количество очков
    level: number;                // Уровень (рассчитывается из очков)
    
    // Бейджи — массив полученных достижений
    badges: Array<{
      id: string;                 // 'novice_explorer', 'traveler_1k', etc.
      earnedAt: Timestamp;
    }>;
    
    // Титулы — разблокированные звания
    titles: string[];             // ['Découvreur', 'Explorateur', ...]
    currentTitle?: string;        // Выбранный для отображения
  };
  
  // ══════════════════════════════════════════
  // ПРЕДПОЧТЕНИЯ
  // Для персонализированных рекомендаций.
  // ══════════════════════════════════════════
  
  preferences: {
    // Автоматически собираемая статистика по категориям
    categoryStats: {
      [category: string]: {       // 'histoire', 'nature', etc.
        viewed: number;           // Просмотрено POI этой категории
        addedToRoute: number;     // Добавлено в маршруты
        checkedIn: number;        // Чекинов в этой категории
      };
    };
  };
  
  // ══════════════════════════════════════════
  // НАСТРОЙКИ ПРИВАТНОСТИ
  // GDPR compliance + пользовательские предпочтения.
  // ══════════════════════════════════════════
  
  privacySettings: {
    // Юридические согласия (обязательны!)
    termsAcceptedAt: Timestamp;
    privacyPolicyAcceptedAt: Timestamp;
    analyticsConsent: boolean;    // Согласие на Firebase Analytics
    
    // Геолокация
    trackingEnabled: boolean;     // Записывать GPS-трек
    trackRetentionDays: 30 | 90 | 365 | 0;  // 0 = хранить всегда
    
    // Видимость профиля
    profileVisibility: 'public' | 'friends' | 'private';
    showInSearch: boolean;        // Можно ли найти по имени
    showOnlineStatus: boolean;    // Показывать онлайн/офлайн
    shareLocationWithFriends: boolean;  // Делиться геолокацией с друзьями
  };
  
  // ══════════════════════════════════════════
  // СИСТЕМНОЕ
  // ══════════════════════════════════════════
  
  role: 'user' | 'admin';
  cardNumber?: string;            // Номер карты лояльности (если есть)
  fromWaitlist: boolean;          // Был ли в waitlist (для бонуса +50)
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastSeenAt?: Timestamp;         // Последняя активность
}
```

#### Субколлекция: users/{userId}/favorites

**Описание:** Избранные POI пользователя.

```typescript
interface Favorite {
  poiId: string;
  poiName: string;                // Денормализация для быстрого списка
  category: string;
  photoUrl?: string;              // Превью
  addedAt: Timestamp;
}
```

#### Субколлекция: users/{userId}/viewHistory

**Описание:** История просмотренных POI. Хранится 30 дней для рекомендаций.

```typescript
interface ViewHistoryItem {
  poiId: string;
  poiName: string;
  category: string;
  viewedAt: Timestamp;
}
```

#### Субколлекция: users/{userId}/notifications

**Описание:** Уведомления пользователя.

```typescript
interface Notification {
  id: string;
  type: 'friend_request' | 'friend_accepted' | 'poi_approved' | 
        'review_approved' | 'badge_earned' | 'friend_nearby';
  
  title: string;                  // "Новая заявка в друзья"
  body: string;                   // "Маша хочет добавить вас в друзья"
  
  // Данные для навигации при нажатии
  data?: {
    userId?: string;
    poiId?: string;
    routeId?: string;
    badgeId?: string;
  };
  
  read: boolean;
  createdAt: Timestamp;
}
```

---

### pois

**Путь:** `pois/{poiId}`

**Описание:** Единая коллекция всех точек интереса. Объединяет бывшие `cached_pois` и `verified_pois`.

```typescript
interface POI {
  // ══════════════════════════════════════════
  // ИДЕНТИФИКАЦИЯ
  // ══════════════════════════════════════════
  
  id: string;                     // OSM ID или сгенерированный UUID
  
  // ══════════════════════════════════════════
  // ОСНОВНЫЕ ДАННЫЕ
  // ══════════════════════════════════════════
  
  name: string;
  description?: string;           // Описание места
  
  // ══════════════════════════════════════════
  // ГЕОДАННЫЕ
  // ══════════════════════════════════════════
  
  latitude: number;
  longitude: number;
  geohash: string;                // Для гео-запросов Firestore
  
  // Локация (для фильтров и статистики)
  location: {
    city?: string;                // "Meaux"
    department?: string;          // "Seine-et-Marne"
    region?: string;              // "Île-de-France"
  };
  
  // ══════════════════════════════════════════
  // КАТЕГОРИЗАЦИЯ
  // Внимание: всегда lowercase!
  // ══════════════════════════════════════════
  
  category: Category;             // 'histoire', 'nature', etc.
  subcategory?: Subcategory;      // 'chateaux', 'forets', etc.
  tags?: string[];                // Дополнительные метки
  
  // ══════════════════════════════════════════
  // МЕДИА
  // ══════════════════════════════════════════
  
  photoUrls: string[];            // Массив URL фотографий (единый формат!)
  
  // ══════════════════════════════════════════
  // ПРАКТИЧЕСКАЯ ИНФОРМАЦИЯ
  // Опциональные поля для POI где это актуально.
  // ══════════════════════════════════════════
  
  openingHours?: string;          // "Lun-Ven: 9h-18h, Sam: 10h-16h"
  phone?: string;
  website?: string;
  priceRange?: 'free' | '€' | '€€' | '€€€';
  
  // ══════════════════════════════════════════
  // РЕЙТИНГ
  // Агрегированные данные для быстрого отображения.
  // Обновляется Cloud Function при новом rating.
  // ══════════════════════════════════════════
  
  rating: {
    average: number;              // Средний балл (1-5)
    count: number;                // Количество оценок
  };
  
  // ══════════════════════════════════════════
  // ИСТОЧНИК И МОДЕРАЦИЯ
  // ══════════════════════════════════════════
  
  source: 'osm' | 'user' | 'admin';
  status: 'draft' | 'pending' | 'published' | 'rejected';
  
  // Кто создал (для source: 'user')
  createdBy?: {
    userId: string;
    userName: string;
    userAvatar?: string;
  };
  
  // Кто проверил (админ)
  verifiedBy?: {
    userId: string;
    verifiedAt: Timestamp;
  };
  
  // ══════════════════════════════════════════
  // WIKIPEDIA / WIKIDATA
  // Для обогащения контента.
  // ══════════════════════════════════════════
  
  wikipedia?: {
    url?: string;
    title?: string;
    wikidataId?: string;
    enrichedAt?: Timestamp;
  };
  
  // ══════════════════════════════════════════
  // МЕТАДАННЫЕ
  // ══════════════════════════════════════════
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ══════════════════════════════════════════
// ТИПЫ КАТЕГОРИЙ (всегда lowercase!)
// ══════════════════════════════════════════

type Category = 
  | 'histoire' 
  | 'nature' 
  | 'panorama' 
  | 'architecture' 
  | 'art' 
  | 'hedonisme' 
  | 'insolite' 
  | 'curiosites';

type Subcategory = 
  // histoire
  | 'monuments' | 'chateaux' | 'eglises' | 'musees' 
  | 'sites-historiques' | 'ruines' | 'memorial' | 'archeologie'
  // nature
  | 'parcs' | 'jardins' | 'forets' | 'lacs' 
  | 'cascades' | 'grottes' | 'reserves' | 'fermes'
  // hedonisme
  | 'gastronomie' | 'restaurants' | 'cafes' | 'bars' 
  | 'vins' | 'vignobles' | 'marches' | 'spas' | 'plages'
  | 'brasseries' | 'fromageries' | 'brocantes' 
  | 'aires-de-repos' | 'chambres-dhotes'
  // panorama
  | 'points-de-vue' | 'belvederes' | 'tours' | 'collines'
  // architecture
  | 'moderne' | 'classique' | 'art-deco' | 'contemporain' 
  | 'religieux' | 'industriel'
  // art
  | 'galeries' | 'sculptures' | 'fresques' | 'land-art'
  // insolite / curiosites
  | 'street-art' | 'lieux-abandonnes' | 'ovni' | 'mystere' 
  | 'legende' | 'paranormal';
```

---

### routes

**Путь:** `routes/{routeId}`

**Описание:** Маршруты пользователей. Ключевая функция приложения.

```typescript
interface Route {
  // ══════════════════════════════════════════
  // ИДЕНТИФИКАЦИЯ
  // ══════════════════════════════════════════
  
  id: string;
  name?: string;                  // Опциональное название маршрута
  
  // ══════════════════════════════════════════
  // СОЗДАТЕЛЬ
  // ══════════════════════════════════════════
  
  userId: string;
  
  // ══════════════════════════════════════════
  // ТОЧКА СТАРТА
  // Геолокация пользователя при начале маршрута.
  // ══════════════════════════════════════════
  
  startLocation: {
    latitude: number;
    longitude: number;
  };
  
  // ══════════════════════════════════════════
  // ТОЧКИ МАРШРУТА
  // POI в порядке добавления/посещения.
  // ══════════════════════════════════════════
  
  waypoints: Array<{
    poiId: string;
    poiName: string;              // Денормализация
    latitude: number;
    longitude: number;
    category: string;
    order: number;                // Порядок в маршруте
    addedAt: Timestamp;
    visitedAt?: Timestamp;        // Когда сделал чекин (null = не посещён)
  }>;
  
  // ══════════════════════════════════════════
  // СТАТУС МАРШРУТА
  // ══════════════════════════════════════════
  
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  
  // draft    — добавляет POI, ещё не начал
  // active   — нажал "Поехали", навигация активна
  // completed — завершил маршрут
  // cancelled — отменил
  
  // ══════════════════════════════════════════
  // СТАТИСТИКА
  // ══════════════════════════════════════════
  
  distance: number;               // Километров (расчётное или фактическое)
  duration: number;               // Минут в пути
  
  // ══════════════════════════════════════════
  // ВРЕМЯ
  // ══════════════════════════════════════════
  
  createdAt: Timestamp;
  startedAt?: Timestamp;          // Когда нажал "Поехали"
  completedAt?: Timestamp;        // Когда завершил
  
  // ══════════════════════════════════════════
  // СОЦИАЛЬНОЕ
  // Для публичных/друзьям маршрутов.
  // ══════════════════════════════════════════
  
  visibility: 'private' | 'friends' | 'public';
  likes: number;
  copiedCount: number;            // Сколько раз скопировали
  
  // Если это копия чужого маршрута
  copiedFrom?: {
    routeId: string;
    userId: string;
    userName: string;
  };
}
```

#### Субколлекция: routes/{routeId}/trackPoints

**Описание:** GPS-трек маршрута. Записывается с умной оптимизацией (каждые 10 сек или 50м).

```typescript
interface TrackPoint {
  lat: number;
  lng: number;
  t: number;                      // Unix timestamp (секунды)
  s?: number;                     // Скорость км/ч
  a?: number;                     // Точность GPS в метрах
}
```

**Оптимизация записи:**
- Минимальный интервал: 10 секунд
- Минимальное расстояние: 50 метров
- Пауза при остановке (скорость < 2 км/ч)

---

### reviews

**Путь:** `reviews/{reviewId}`

**Описание:** Комментарии к POI.

```typescript
interface Review {
  id: string;
  
  // Связи (только ID!)
  userId: string;
  poiId: string;
  
  // Контент
  comment: string;
  photoUrl?: string;              // Фото к отзыву
  
  // Видимость и модерация
  privacy: 'public' | 'friends';
  status: 'pending' | 'approved' | 'rejected';
  
  createdAt: Timestamp;
}
```

**⚠️ Важно:** Не храним `userName`, `userAvatar`, `poiName` — подтягиваем при отображении. При удалении аккаунта — анонимизируем.

---

### checkIns

**Путь:** `checkIns/{checkInId}`

**Описание:** Отметки посещения POI.

```typescript
interface CheckIn {
  id: string;                     // Формат: `${userId}_${poiId}_${timestamp}`
  userId: string;
  poiId: string;
  routeId?: string;               // В рамках какого маршрута (если есть)
  
  createdAt: Timestamp;
}
```

---

### ratings

**Путь:** `ratings/{ratingId}`

**Описание:** Оценки POI (1-5 звёзд).

```typescript
interface Rating {
  id: string;                     // Формат: `${userId}_${poiId}`
  userId: string;
  poiId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  
  createdAt: Timestamp;
  updatedAt?: Timestamp;          // Если изменил оценку
}
```

---

### friendRequests

**Путь:** `friendRequests/{requestId}`

**Описание:** Заявки в друзья.

```typescript
interface FriendRequest {
  id: string;
  
  fromUserId: string;
  toUserId: string;
  
  status: 'pending' | 'accepted' | 'rejected';
  
  // Денормализация для отображения (обновляется при смене профиля)
  fromUserName: string;
  fromUserAvatar?: string;
  
  createdAt: Timestamp;
  respondedAt?: Timestamp;
}
```

---

### reports

**Путь:** `reports/{reportId}`

**Описание:** Жалобы на контент.

```typescript
interface Report {
  id: string;
  
  // Кто пожаловался
  reporterId: string;
  
  // На что жалоба
  targetType: 'poi' | 'review' | 'user' | 'route';
  targetId: string;
  
  // Причина
  reason: 'spam' | 'offensive' | 'incorrect' | 'copyright' | 'other';
  description?: string;           // Подробности
  
  // Модерация
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewedBy?: string;            // Admin userId
  resolution?: string;            // Что сделали
  
  createdAt: Timestamp;
  reviewedAt?: Timestamp;
}
```

---

### waitlist

**Путь:** `waitlist/{entryId}`

**Описание:** Email-подписки с лендинга.

```typescript
interface WaitlistEntry {
  id: string;
  email: string;
  source: 'landing_page' | 'landing_page_french' | 'app';
  lang: 'fr' | 'en';
  
  // Конверсия
  convertedToUser: boolean;       // Зарегистрировался ли
  convertedAt?: Timestamp;
  userId?: string;                // Если зарегистрировался
  
  createdAt: Timestamp;
}
```

---

### coverage

**Путь:** `coverage/{geohash}`

**Описание:** Агрегированные данные треков для тепловой карты. Обновляется Cloud Function при завершении маршрута.

```typescript
interface CoverageCell {
  geohash: string;                // ~5км² ячейка (5 символов)
  
  totalPasses: number;            // Сколько раз проехали
  uniqueUsers: number;            // Уникальных пользователей
  
  lastUpdated: Timestamp;
}
```

---

## 🚀 План миграции

### Принципы безопасной миграции

1. **Не удалять старые коллекции** до полной проверки
2. **Параллельная работа** — новый код пишет в обе коллекции
3. **Поэтапное внедрение** — по одной коллекции за раз
4. **Бэкапы** перед каждым этапом

---

### Фаза 0: Подготовка (1 день)

**Бэкап базы данных:**
```bash
# Экспорт через Firebase CLI
firebase firestore:export gs://guide-du-detour-backups/backup-2025-01-XX
```

**Создать тестовый проект:**
- Скопировать данные в dev-проект
- Тестировать миграцию там

---

### Фаза 1: Нормализация категорий (без даунтайма)

**Скрипт миграции:**
```javascript
// Привести все категории к lowercase
async function normalizeCategories() {
  const batch = db.batch();
  
  const snapshot = await db.collection('cached_pois').get();
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const normalized = data.category?.toLowerCase();
    
    if (normalized !== data.category) {
      batch.update(doc.ref, { category: normalized });
    }
  });
  
  await batch.commit();
}
```

**Обновить код приложения:**
- Все записи категорий через `.toLowerCase()`
- Все запросы категорий через `.toLowerCase()`

---

### Фаза 2: Унификация фото-полей (без даунтайма)

**Скрипт миграции:**
```javascript
async function normalizePhotos() {
  const snapshot = await db.collection('cached_pois').get();
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const photoUrls = new Set();
    
    // Собрать все фото из разных полей
    if (data.photoURL) photoUrls.add(data.photoURL);
    if (data.photoUrl) photoUrls.add(data.photoUrl);
    if (data.photoUrls?.length) {
      data.photoUrls.forEach(url => photoUrls.add(url));
    }
    
    // Убрать пустые
    const cleanUrls = [...photoUrls].filter(url => url && url.trim());
    
    await doc.ref.update({
      photoUrls: cleanUrls,
      // Не удаляем старые поля пока!
    });
  }
}
```

**Обновить код:**
- Читать только `photoUrls`
- Писать только в `photoUrls`

---

### Фаза 3: Объединение POI коллекций

**Шаг 1: Добавить поле status в cached_pois**
```javascript
// Все существующие POI — published
await db.collection('cached_pois').get().then(snapshot => {
  snapshot.docs.forEach(doc => {
    doc.ref.update({ status: 'published' });
  });
});
```

**Шаг 2: Скопировать verified_pois в cached_pois**
```javascript
const verified = await db.collection('verified_pois').get();

for (const doc of verified.docs) {
  await db.collection('cached_pois').doc(doc.id).set({
    ...doc.data(),
    status: 'published',
    source: doc.data().source || 'admin'
  }, { merge: true });
}
```

**Шаг 3: Обновить код приложения и админки**
- Читать из `cached_pois` (потом переименуем)
- Убрать все обращения к `verified_pois`

**Шаг 4: Переименовать коллекцию**
```javascript
// Firestore не поддерживает переименование,
// поэтому создаём новую и копируем
async function renameToPois() {
  const snapshot = await db.collection('cached_pois').get();
  
  for (const doc of snapshot.docs) {
    await db.collection('pois').doc(doc.id).set(doc.data());
  }
}
```

**Шаг 5: Переключить код на `pois`**

**Шаг 6: Удалить старые коллекции** (через неделю после проверки)

---

### Фаза 4: Обновление структуры users

**Скрипт миграции:**
```javascript
async function migrateUsers() {
  const snapshot = await db.collection('users').get();
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    const newStructure = {
      // Перенос существующих полей
      id: doc.id,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      displayName: data.displayName || `${data.firstName} ${data.lastName}`,
      avatarUrl: data.avatarURL || data.avatarUrl || null,
      
      // Auth block
      auth: {
        providers: ['email'], // Определить по данным
        email: data.email,
        emailVerified: true
      },
      
      // Объединение статистики
      stats: {
        routesCompleted: 0,
        kmTraveled: data.totalKm || data.totalKmTraveled || 0,
        poisViewed: 0,
        poisAddedToRoutes: 0,
        checkIns: data.totalCheckIns || data.checkInCount || 0,
        ratingsGiven: data.totalRatings || 0,
        reviewsApproved: 0,
        reviewsPublic: 0,
        reviewsFriends: 0,
        poisCreated: data.totalPOIsCreated || 0,
        poisEdited: 0,
        routesShared: 0,
        routesCopied: 0
      },
      
      // Gamification
      gamification: {
        points: data.points || 0,
        level: data.level || 1,
        badges: (data.badges || []).map(b => ({
          id: b,
          earnedAt: Timestamp.now()
        })),
        titles: data.titles || [],
        currentTitle: null
      },
      
      // Новые поля
      friends: data.friends || [],
      blockedUsers: [],
      savedPlaces: {},
      preferences: { categoryStats: {} },
      privacySettings: {
        termsAcceptedAt: Timestamp.now(),
        privacyPolicyAcceptedAt: Timestamp.now(),
        analyticsConsent: true,
        trackingEnabled: true,
        trackRetentionDays: 90,
        profileVisibility: data.visibility || 'friends',
        showInSearch: true,
        showOnlineStatus: true,
        shareLocationWithFriends: false
      },
      
      role: data.role || 'user',
      cardNumber: data.cardNumber || null,
      fromWaitlist: false,
      createdAt: data.createdAt || Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    await doc.ref.set(newStructure, { merge: true });
  }
}
```

---

### Фаза 5: Создание новых коллекций

Новые коллекции создаются автоматически при первой записи:
- `routes/`
- `friendRequests/`
- `reports/`
- `coverage/`
- Субколлекции `favorites/`, `viewHistory/`, `notifications/`

---

### Фаза 6: Очистка (через 2 недели)

После проверки что всё работает:
```javascript
// Удалить старые поля из POI
const poisSnapshot = await db.collection('pois').get();
for (const doc of poisSnapshot.docs) {
  await doc.ref.update({
    photoURL: FieldValue.delete(),
    photoUrl: FieldValue.delete(),
    // другие устаревшие поля
  });
}

// Удалить старые коллекции
// (вручную через Firebase Console после финальной проверки)
```

---

## 🔒 Приватность и GDPR

### Хранимые персональные данные

| Данные | Категория | Основание |
|--------|-----------|-----------|
| Email | Персональные | Договор (регистрация) |
| Имя, фамилия | Персональные | Договор |
| Фото профиля | Персональные | Согласие |
| Геолокация (трек) | **Особая категория** | **Явное согласие** |
| Адрес дома | Персональные | Согласие |
| История просмотров | Профилирование | Согласие |

---

### Обязательные согласия при регистрации

```
☑️ J'accepte les Conditions d'utilisation (обязательно)
☑️ J'accepte la Politique de confidentialité (обязательно)
☐ J'autorise l'enregistrement de mes trajets (опционально)
☐ J'autorise les statistiques anonymes (опционально)
```

---

### Права пользователя (GDPR)

| Право | Реализация |
|-------|------------|
| Доступ к данным | Кнопка "Exporter mes données" → JSON |
| Исправление | Редактирование профиля |
| Удаление | Кнопка "Supprimer mon compte" |
| Ограничение обработки | Настройки приватности |
| Переносимость | Экспорт в JSON |

---

### Удаление аккаунта — что происходит

```
УДАЛЯЕТСЯ:
├── users/{userId}              — весь документ
├── users/{userId}/favorites/   — все избранные
├── users/{userId}/viewHistory/ — вся история
├── users/{userId}/notifications/ — все уведомления
├── routes/{*} where userId     — все маршруты
├── friendRequests/{*}          — все заявки
└── Firebase Auth account       — аккаунт авторизации

АНОНИМИЗИРУЕТСЯ:
├── reviews/{*}
│   └── userId → "deleted_user"
├── ratings/{*}
│   └── userId → "deleted_user"  
├── checkIns/{*}
│   └── userId → "deleted_user"
└── reports/{*}
    └── reporterId → "deleted_user"

СОХРАНЯЕТСЯ (анонимно):
├── Счётчики рейтингов POI
└── Агрегированные данные coverage/
```

---

### Автоудаление данных

**Cloud Function (ежедневно в 3:00):**

```javascript
// Удаление старых треков
async function cleanupOldTracks() {
  const users = await db.collection('users').get();
  
  for (const userDoc of users.docs) {
    const retention = userDoc.data().privacySettings?.trackRetentionDays;
    if (!retention || retention === 0) continue; // 0 = хранить всегда
    
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retention);
    
    // Найти старые маршруты этого пользователя
    const routes = await db.collection('routes')
      .where('userId', '==', userDoc.id)
      .where('completedAt', '<', cutoff)
      .get();
    
    for (const route of routes.docs) {
      // Удалить трек-поинты
      const trackPoints = await route.ref.collection('trackPoints').get();
      for (const point of trackPoints.docs) {
        await point.ref.delete();
      }
    }
  }
}

// Удаление старой истории просмотров (30 дней)
async function cleanupViewHistory() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  
  const users = await db.collection('users').get();
  
  for (const userDoc of users.docs) {
    const history = await userDoc.ref.collection('viewHistory')
      .where('viewedAt', '<', cutoff)
      .get();
    
    for (const item of history.docs) {
      await item.ref.delete();
    }
  }
}
```

---

## 📊 Система очков (напоминание)

| Действие | Очки |
|----------|------|
| Добавление нового POI (одобрено) | +10 |
| Описание или фото к POI (одобрено) | +10 |
| Комментарий к POI | +5 |
| Поделиться POI с друзьями | +5 |
| Поставить рейтинг 5 звёзд | +5 |
| Регистрация из waitlist | +50 |

### Бейджи за очки

| Очки | ID бейджа | Название |
|------|-----------|----------|
| 100 | `novice_explorer` | Новичок-исследователь |
| 500 | `category_lover_{cat}` | Тематический |
| 1000 | `advanced_explorer` | Продвинутый исследователь |
| 5000 | `route_master` | Мастер маршрутов |

### Бейджи за километры

| Км | ID бейджа | Название |
|----|-----------|----------|
| 1000 | `traveler_1k` | Путешественник |
| 5000 | `traveler_5k` | Странник дорог |
| 10000 | `traveler_10k` | Мастер дальних маршрутов |

---

## ✅ Чеклист внедрения

### Перед началом
- [ ] Бэкап всей базы данных
- [ ] Создать тестовый Firebase проект
- [ ] Протестировать миграцию на тестовых данных

### Фаза 1-2 (можно делать сразу)
- [ ] Нормализовать категории → lowercase
- [ ] Унифицировать фото → photoUrls[]
- [ ] Обновить код приложения
- [ ] Обновить код админки
- [ ] Протестировать

### Фаза 3 (объединение POI)
- [ ] Добавить status в cached_pois
- [ ] Скопировать verified_pois
- [ ] Переключить код на единую коллекцию
- [ ] Создать коллекцию pois
- [ ] Переключить на pois
- [ ] Удалить старые коллекции (через неделю)

### Фаза 4 (users)
- [ ] Мигрировать структуру users
- [ ] Добавить новые поля
- [ ] Обновить код профиля

### Фаза 5 (новые функции)
- [ ] Реализовать routes
- [ ] Реализовать friendRequests
- [ ] Реализовать favorites
- [ ] Настроить Cloud Functions

### После внедрения
- [ ] Мониторинг ошибок (7 дней)
- [ ] Очистка устаревших полей
- [ ] Удаление старых коллекций

---

**Конец документа**

*Версия 2.0 — 29 декабря 2025*
