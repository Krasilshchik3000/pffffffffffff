# Инструкция по деплою бота

## Вариант 1: Railway (Рекомендуется)

1. **Создай аккаунт на Railway:**
   - Перейди на https://railway.app
   - Зарегистрируйся через GitHub

2. **Создай новый проект:**
   - Нажми "New Project"
   - Выбери "Deploy from GitHub repo"
   - Подключи этот репозиторий

3. **Настрой переменные окружения:**
   - В настройках проекта добавь переменную `BOT_TOKEN` со значением `7624758051:AAGjLs1BLaF43CjTjPIwd3pJlKvprNaenZA`
   - Добавь переменную `PODCAST_ID` со значением `1371411915`

4. **Деплой:**
   - Railway автоматически задеплоит бота
   - Бот будет доступен 24/7

## Вариант 2: Heroku

1. **Создай аккаунт на Heroku:**
   - Перейди на https://heroku.com
   - Зарегистрируйся

2. **Установи Heroku CLI:**
   ```bash
   brew install heroku/brew/heroku
   ```

3. **Логин и создание приложения:**
   ```bash
   heroku login
   heroku create pffff-bot-unique-name
   ```

4. **Настрой переменные окружения:**
   ```bash
   heroku config:set BOT_TOKEN=7624758051:AAGjLs1BLaF43CjTjPIwd3pJlKvprNaenZA
   heroku config:set PODCAST_ID=1371411915
   ```

5. **Деплой:**
   ```bash
   git push heroku main
   ```

## Вариант 3: Render

1. **Создай аккаунт на Render:**
   - Перейди на https://render.com
   - Зарегистрируйся через GitHub

2. **Создай новый Web Service:**
   - Подключи GitHub репозиторий
   - Выбери Node.js environment
   - Build Command: `npm install`
   - Start Command: `npm start`

3. **Настрой переменные окружения:**
   - Добавь `BOT_TOKEN=7624758051:AAGjLs1BLaF43CjTjPIwd3pJlKvprNaenZA`
   - Добавь `PODCAST_ID=1371411915`

## Автоматический деплой

После настройки любого из сервисов, каждый push в main ветку будет автоматически деплоить новую версию бота.

## Проверка работы

После деплоя бот будет доступен по адресу @pffffffffffff_bot в Telegram.
Команды:
- `/start` - приветствие
- `/reviews` - получить последние 20 рецензий
- `/help` - справка
