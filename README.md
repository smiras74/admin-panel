# Guide du Détour - Admin Panel

Панель администратора для управления приложением Guide du Détour.

## Функционал

### Dashboard
- Общая статистика: пользователи, check-ins, километры
- Счётчики ожидающих модерации элементов
- Быстрые действия для перехода к модерации

### Модерация
- **Новые POI** — пользовательские точки интереса на проверку
- **Изменения** — редактирования названия/описания/фото с diff-view
- **Комментарии** — публичные отзывы (privacy ≠ "Amis")

### POI Management
- Просмотр всех POI из трёх коллекций (verified, cached, custom)
- Поиск и фильтрация по категории/источнику
- Ссылки на Google Maps

### Users
- Список пользователей со статистикой
- Поиск по имени/email
- Сортировка по дате/активности

## Технологии

- **Next.js 14** — App Router, Server Components
- **Firebase Admin SDK** — серверные операции с Firestore
- **Tailwind CSS** — стилизация, mobile-first
- **TypeScript** — типизация

## Установка

1. Клонируйте репозиторий
2. Установите зависимости:
   ```bash
   npm install
   ```

3. Создайте файл `.env.local` на основе `.env.local.example`:
   ```bash
   cp .env.local.example .env.local
   ```

4. Заполните переменные окружения:
   - Firebase Admin credentials (из Service Account)
   - Firebase Client config (из Firebase Console)

5. Запустите dev-сервер:
   ```bash
   npm run dev
   ```

## Деплой на Vercel

1. Подключите репозиторий к Vercel
2. Добавьте все переменные окружения в Project Settings → Environment Variables
3. Deploy!

### Важно для FIREBASE_PRIVATE_KEY

В Vercel нужно добавить приватный ключ с сохранением `\n`:
```
-----BEGIN PRIVATE KEY-----\nMIIEvg...\n-----END PRIVATE KEY-----\n
```

## Структура проекта

```
├── app/
│   ├── api/
│   │   ├── auth/verify/    # Проверка админ-прав
│   │   ├── moderation/     # API модерации
│   │   ├── pois/           # API для POI
│   │   ├── stats/          # Статистика dashboard
│   │   └── users/          # API пользователей
│   ├── login/              # Страница входа
│   ├── moderation/         # Страница модерации
│   ├── pois/               # Управление POI
│   ├── users/              # Управление пользователями
│   ├── layout.tsx
│   ├── page.tsx            # Dashboard
│   └── globals.css
├── components/
│   ├── Navigation.tsx      # Навигация + mobile drawer
│   └── StatCard.tsx        # Карточки статистики
├── lib/
│   ├── auth-context.tsx    # React context для auth
│   ├── firebase-admin.ts   # Firebase Admin SDK
│   └── firebase-client.ts  # Firebase Client SDK
└── types/
    └── index.ts            # TypeScript типы
```

## Добавление админов

По умолчанию доступ есть только у email из списка `ADMIN_EMAILS` в `app/api/auth/verify/route.ts`.

Также можно добавить поле `role: "admin"` в документ пользователя в Firestore.

## Адаптивность

- Desktop: боковое меню
- Mobile: 
  - Верхняя панель с бургер-меню
  - Нижняя навигация
  - Drawer меню

## Безопасность

- Все API routes проверяют Firebase Auth токен
- Проверка роли admin/moderator
- Firestore Security Rules остаются как есть
