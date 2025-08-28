const { Telegraf } = require('telegraf');
const store = require('app-store-scraper');
const fs = require('fs').promises;
const path = require('path');

// Токен бота (из переменных окружения или константы для разработки)
const BOT_TOKEN = process.env.BOT_TOKEN || '7624758051:AAGjLs1BLaF43CjTjPIwd3pJlKvprNaenZA';

// ID подкаста "Два по цене одного"
const PODCAST_ID = process.env.PODCAST_ID || '1371411915';

// Полный список стран для поиска рецензий (топ 50 стран по популярности Apple Store)
const COUNTRIES = [
    { code: 'us', name: 'США' },
    { code: 'gb', name: 'Великобритания' },
    { code: 'ca', name: 'Канада' },
    { code: 'au', name: 'Австралия' },
    { code: 'de', name: 'Германия' },
    { code: 'fr', name: 'Франция' },
    { code: 'it', name: 'Италия' },
    { code: 'es', name: 'Испания' },
    { code: 'ru', name: 'Россия' },
    { code: 'jp', name: 'Япония' },
    { code: 'kr', name: 'Южная Корея' },
    { code: 'cn', name: 'Китай' },
    { code: 'in', name: 'Индия' },
    { code: 'br', name: 'Бразилия' },
    { code: 'mx', name: 'Мексика' },
    { code: 'ar', name: 'Аргентина' },
    { code: 'cl', name: 'Чили' },
    { code: 'co', name: 'Колумбия' },
    { code: 'pe', name: 'Перу' },
    { code: 'nl', name: 'Нидерланды' },
    { code: 'be', name: 'Бельгия' },
    { code: 'ch', name: 'Швейцария' },
    { code: 'at', name: 'Австрия' },
    { code: 'se', name: 'Швеция' },
    { code: 'no', name: 'Норвегия' },
    { code: 'dk', name: 'Дания' },
    { code: 'fi', name: 'Финляндия' },
    { code: 'pl', name: 'Польша' },
    { code: 'cz', name: 'Чехия' },
    { code: 'hu', name: 'Венгрия' },
    { code: 'sk', name: 'Словакия' },
    { code: 'si', name: 'Словения' },
    { code: 'hr', name: 'Хорватия' },
    { code: 'bg', name: 'Болгария' },
    { code: 'ro', name: 'Румыния' },
    { code: 'lt', name: 'Литва' },
    { code: 'lv', name: 'Латвия' },
    { code: 'ee', name: 'Эстония' },
    { code: 'ua', name: 'Украина' },
    { code: 'by', name: 'Беларусь' },
    { code: 'kz', name: 'Казахстан' },
    { code: 'uz', name: 'Узбекистан' },
    { code: 'kg', name: 'Кыргызстан' },
    { code: 'tj', name: 'Таджикистан' },
    { code: 'tm', name: 'Туркменистан' },
    { code: 'az', name: 'Азербайджан' },
    { code: 'ge', name: 'Грузия' },
    { code: 'am', name: 'Армения' },
    { code: 'md', name: 'Молдова' },
    { code: 'rs', name: 'Сербия' },
    { code: 'me', name: 'Черногория' },
    { code: 'mk', name: 'Северная Македония' },
    { code: 'ba', name: 'Босния и Герцеговина' },
    { code: 'al', name: 'Албания' },
    { code: 'il', name: 'Израиль' },
    { code: 'tr', name: 'Турция' },
    { code: 'sa', name: 'Саудовская Аравия' },
    { code: 'ae', name: 'ОАЭ' },
    { code: 'eg', name: 'Египет' },
    { code: 'za', name: 'ЮАР' },
    { code: 'ng', name: 'Нигерия' },
    { code: 'ke', name: 'Кения' },
    { code: 'th', name: 'Таиланд' },
    { code: 'vn', name: 'Вьетнам' },
    { code: 'sg', name: 'Сингапур' },
    { code: 'my', name: 'Малайзия' },
    { code: 'id', name: 'Индонезия' },
    { code: 'ph', name: 'Филиппины' },
    { code: 'nz', name: 'Новая Зеландия' },
    { code: 'pt', name: 'Португалия' },
    { code: 'gr', name: 'Греция' },
    { code: 'cy', name: 'Кипр' },
    { code: 'mt', name: 'Мальта' },
    { code: 'lu', name: 'Люксембург' },
    { code: 'ie', name: 'Ирландия' },
    { code: 'is', name: 'Исландия' }
];

// Создание экземпляра бота
const bot = new Telegraf(BOT_TOKEN);

// Функция для получения рецензий подкаста из всех стран
async function getPodcastReviews(ctx) {
    try {
        console.log('Получение рецензий подкаста из всех стран...');
        
        const allReviews = [];
        let processedCountries = 0;
        let totalCountries = COUNTRIES.length;
        
        // Отправляем начальное сообщение о прогрессе
        const progressMessage = await ctx.reply(`🔍 Начинаю поиск рецензий...\nПроверяю ${totalCountries} стран. Это может занять 1-2 минуты.`);
        
        // Получаем рецензии из каждой страны
        for (const country of COUNTRIES) {
            try {
                console.log(`Получение рецензий из ${country.name} (${country.code})...`);
                
                const reviews = await store.reviews({
                    id: PODCAST_ID,
                    country: country.code,
                    page: 1,
                    sort: store.sort.RECENT
                });

                // Добавляем информацию о стране к каждой рецензии
                const reviewsWithCountry = reviews.map(review => ({
                    ...review,
                    countryCode: country.code,
                    countryName: country.name
                }));
                
                allReviews.push(...reviewsWithCountry);
                console.log(`Получено ${reviews.length} рецензий из ${country.name}`);
                
                processedCountries++;
                
                // Обновляем прогресс каждые 10 стран
                if (processedCountries % 10 === 0 || processedCountries === totalCountries) {
                    try {
                        await ctx.telegram.editMessageText(
                            progressMessage.chat.id,
                            progressMessage.message_id,
                            null,
                            `🔍 Поиск рецензий: ${processedCountries}/${totalCountries} стран проверено\n📊 Найдено ${allReviews.length} рецензий`
                        );
                    } catch (editError) {
                        // Игнорируем ошибки редактирования сообщения
                    }
                }
                
                // Небольшая задержка между запросами, чтобы не перегружать API
                await new Promise(resolve => setTimeout(resolve, 150));
                
            } catch (countryError) {
                console.error(`Ошибка при получении рецензий из ${country.name}:`, countryError.message);
                processedCountries++;
                // Продолжаем с другими странами
            }
        }
        
        // Сортируем все рецензии по дате (новые первыми)
        allReviews.sort((a, b) => {
            const dateA = new Date(a.updated || 0);
            const dateB = new Date(b.updated || 0);
            return dateB - dateA;
        });
        
        // Берем только последние 20 рецензий
        const latestReviews = allReviews.slice(0, 20);
        
        console.log(`Всего получено ${allReviews.length} рецензий из ${COUNTRIES.length} стран`);
        console.log(`Отобрано последних ${latestReviews.length} рецензий`);
        
        // Финальное сообщение о завершении поиска
        try {
            await ctx.telegram.editMessageText(
                progressMessage.chat.id,
                progressMessage.message_id,
                null,
                `✅ Поиск завершен!\n📊 Проверено ${totalCountries} стран\n📝 Найдено ${allReviews.length} рецензий\n⭐ Отобрано последних ${latestReviews.length} рецензий`
            );
        } catch (editError) {
            // Игнорируем ошибки редактирования сообщения
        }
        
        return latestReviews;
    } catch (error) {
        console.error('Ошибка при получении рецензий:', error);
        throw error;
    }
}

// Функция для очистки текста от лишних символов и форматирования
function cleanText(text) {
    if (!text) return text;
    // Убираем переносы строк и лишние пробелы, сохраняем эмодзи
    return text.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
}

// Функция для экранирования специальных символов Markdown, но сохранения эмодзи
function escapeMarkdownKeepEmoji(text) {
    if (!text) return text;
    // Экранируем только специальные символы Markdown, не трогая эмодзи
    return text.replace(/([_*\[\]()~`>#+=|{}.!-])/g, '\\$1');
}

// Функция для безопасного экранирования Markdown
function escapeMarkdown(text) {
    if (!text) return text;
    // Экранируем только самые проблемные символы для Markdown
    return text.replace(/([_`\[\]])/g, '\\$1');
}

// Функция для форматирования рецензии в текст сообщения
function formatReviewMessage(review, index) {
    let message = `📝 Рецензия ${index + 1}\n\n`;
    message += `📌 *${escapeMarkdown(cleanText(review.title || 'Без названия'))}*\n`;
    message += `👤 Автор: ${escapeMarkdown(cleanText(review.userName || 'Аноним'))}\n`;
    message += `🌍 Страна: ${review.countryName || 'Неизвестно'} (${review.countryCode || '?'})\n`;
    message += `⭐ Оценка: ${'★'.repeat(review.score || 0)}${'☆'.repeat(5 - (review.score || 0))} (${review.score || 0}/5)\n`;
    
    // Форматируем дату - теперь используем поле updated
    let dateStr = 'Дата неизвестна';
    if (review.updated) {
        const date = new Date(review.updated);
        dateStr = date.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } else if (review.date) {
        const date = new Date(review.date);
        dateStr = date.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long', 
            day: 'numeric'
        });
    }
    message += `📅 Дата: ${dateStr}\n\n`;
    
    message += `💬 *Текст рецензии:*\n${escapeMarkdown(cleanText(review.text || 'Без комментария'))}`;
    
    return message;
}

// Обработка команды /start
bot.start((ctx) => {
    ctx.reply(
        'Привет! Я бот для получения рецензий подкаста "Два по цене одного".\n\n' +
        'Команды:\n' +
        '/reviews - получить последние 20 рецензий\n' +
        '/help - показать справку'
    );
});

// Обработка команды /help
bot.help((ctx) => {
    ctx.reply(
        'Доступные команды:\n\n' +
        '/reviews - получить последние 20 рецензий подкаста в виде текстового файла\n' +
        '/help - показать эту справку\n\n' +
        'Подкаст: "Два по цене одного" в Apple Podcasts'
    );
});

// Обработка команды /reviews
bot.command('reviews', async (ctx) => {
    try {
        // Получаем рецензии (функция сама показывает прогресс)
        const reviews = await getPodcastReviews(ctx);
        
        if (reviews.length === 0) {
            await ctx.reply('Рецензии не найдены.');
            return;
        }
        
        // Отправляем заголовочное сообщение
        await ctx.reply(`🎧 *Последние ${reviews.length} рецензий подкаста "Два по цене одного"*\n\nОтправляю по одной рецензии\\.\\.\\.`, { parse_mode: 'MarkdownV2' });
        
        // Отправляем каждую рецензию отдельным сообщением
        for (let i = 0; i < reviews.length; i++) {
            const reviewMessage = formatReviewMessage(reviews[i], i);
            
            try {
                // Отправляем с Markdown режимом для правильного форматирования
                await ctx.reply(reviewMessage, { parse_mode: 'Markdown' });
                
                // Небольшая задержка между сообщениями, чтобы не превысить лимиты Telegram
                if (i < reviews.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            } catch (msgError) {
                console.error(`Ошибка отправки рецензии ${i + 1}:`, msgError);
                // Если Markdown не работает, отправляем без форматирования
                try {
                    const plainMessage = reviewMessage.replace(/\*/g, '');
                    await ctx.reply(plainMessage);
                } catch (plainError) {
                    // В крайнем случае отправляем упрощенную версию
                    const simpleMessage = `Рецензия ${i + 1}\n\n${reviews[i].title || 'Без названия'}\nАвтор: ${reviews[i].userName || 'Аноним'}\nСтрана: ${reviews[i].countryName}\nОценка: ${reviews[i].score}/5\n\n${reviews[i].text || 'Без комментария'}`;
                    await ctx.reply(simpleMessage);
                }
            }
        }
        
        await ctx.reply(`✅ Все ${reviews.length} рецензий отправлены!`);
        
    } catch (error) {
        console.error('Ошибка при обработке команды /reviews:', error);
        await ctx.reply('Произошла ошибка при получении рецензий. Попробуйте позже.');
    }
});

// Обработка неизвестных команд
bot.on('text', (ctx) => {
    ctx.reply('Неизвестная команда. Используйте /help для просмотра доступных команд.');
});

// Обработка ошибок
bot.catch((err, ctx) => {
    console.error('Ошибка бота:', err);
    ctx.reply('Произошла внутренняя ошибка. Попробуйте позже.');
});

// Запуск бота
console.log('Запуск бота...');
const PORT = process.env.PORT || 3000;

bot.launch().then(() => {
    console.log('Бот успешно запущен!');
}).catch(err => {
    console.error('Ошибка запуска бота:', err);
});

// Простой HTTP сервер для Railway
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Telegram Bot is running!');
});

server.listen(PORT, () => {
    console.log(`HTTP сервер запущен на порту ${PORT}`);
});

// Graceful shutdown
process.once('SIGINT', () => {
    server.close();
    bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
    server.close();
    bot.stop('SIGTERM');
});
