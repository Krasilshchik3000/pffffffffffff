const { Telegraf } = require('telegraf');
const store = require('app-store-scraper');
const fs = require('fs').promises;
const path = require('path');
const Parser = require('rss-parser');
const parser = new Parser();
const axios = require('axios');
const cheerio = require('cheerio');

// Токен бота (из переменных окружения или константы для разработки)
const BOT_TOKEN = process.env.BOT_TOKEN || '7624758051:AAGjLs1BLaF43CjTjPIwd3pJlKvprNaenZA';

// ID подкаста "Два по цене одного"
const PODCAST_ID = process.env.PODCAST_ID || '1371411915';

// RSS-лента для мониторинга новых эпизодов
const RSS_FEED_URL = 'https://feeds.transistor.fm/8ad5c0b4-9622-4e86-ba14-2a2e436f68b3';

// Базовая статистика подкастов (на 28 августа 2025)
const PODCAST_STATS = {
    totalEpisodes: 245,
    totalHours: 164,
    startDate: new Date('2018-04-12') // 12 апреля 2018 года
};

// Файлы для хранения данных
const STATS_FILE = path.join(__dirname, 'podcast_stats.json');
const CHATS_FILE = path.join(__dirname, 'subscribed_chats.json');



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
async function getPodcastReviews(ctx, limit = 20) {
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
        
        // Берем только последние рецензии в указанном количестве
        const latestReviews = allReviews.slice(0, limit);
        
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

// Функция для получения рецензий за последний месяц
async function getMonthlyReviews(ctx, showProgress = true) {
    try {
        console.log('Получение рецензий за последний месяц...');
        
        const allReviews = [];
        let processedCountries = 0;
        let totalCountries = COUNTRIES.length;
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        
        // Отправляем начальное сообщение о прогрессе только если нужно
        let progressMessage = null;
        if (showProgress) {
            progressMessage = await ctx.reply(`🗓️ Ищу рецензии за последний месяц...\nПроверяю ${totalCountries} стран. Это может занять 1-2 минуты.`);
        }
        
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

                // Фильтруем рецензии за последний месяц
                const monthlyReviews = reviews.filter(review => {
                    if (!review.updated) return false;
                    const reviewDate = new Date(review.updated);
                    return reviewDate >= oneMonthAgo;
                });

                // Добавляем информацию о стране к каждой рецензии
                const reviewsWithCountry = monthlyReviews.map(review => ({
                    ...review,
                    countryCode: country.code,
                    countryName: country.name
                }));
                
                allReviews.push(...reviewsWithCountry);
                console.log(`Получено ${monthlyReviews.length} рецензий за месяц из ${country.name}`);
                
                processedCountries++;
                
                // Обновляем прогресс каждые 10 стран (только если показываем прогресс)
                if (showProgress && progressMessage && (processedCountries % 10 === 0 || processedCountries === totalCountries)) {
                    try {
                        await ctx.telegram.editMessageText(
                            progressMessage.chat.id,
                            progressMessage.message_id,
                            null,
                            `🗓️ Поиск месячных рецензий: ${processedCountries}/${totalCountries} стран проверено\n📊 Найдено ${allReviews.length} рецензий за месяц`
                        );
                    } catch (editError) {
                        // Игнорируем ошибки редактирования сообщения
                    }
                }
                
                // Небольшая задержка между запросами
                await new Promise(resolve => setTimeout(resolve, 150));
                
            } catch (countryError) {
                console.error(`Ошибка при получении рецензий из ${country.name}:`, countryError.message);
                processedCountries++;
            }
        }
        
        // Сортируем все рецензии по дате (новые первыми)
        allReviews.sort((a, b) => {
            const dateA = new Date(a.updated || 0);
            const dateB = new Date(b.updated || 0);
            return dateB - dateA;
        });
        
        console.log(`Всего получено ${allReviews.length} рецензий за месяц из ${COUNTRIES.length} стран`);
        
        // Финальное сообщение с правильными склонениями
        const storeForm = getCorrectForm(totalCountries, ['стор', 'стора', 'сторов']);
        const reviewForm = getCorrectForm(allReviews.length, ['рецензию', 'рецензии', 'рецензий']);
        
        let finalMessage;
        if (allReviews.length === 0) {
            const randomPhrases = [
                'Это печально!',
                'Эхх.',
                'Дичь!',
                'Че за бред.',
                'С этим надо что-то делать.',
                'Бывает.'
            ];
            const randomPhrase = randomPhrases[Math.floor(Math.random() * randomPhrases.length)];
            finalMessage = `Я проверила ${totalCountries} ${storeForm} и не нашла ни одной рецензии. ${randomPhrase}`;
        } else {
            const reviewWord = allReviews.length === 1 ? 'она' : 'они';
            finalMessage = `Я проверила ${totalCountries} ${storeForm} и нашла ${allReviews.length} ${reviewForm} за последний месяц. Вот ${reviewWord}:`;
        }
        
        if (showProgress && progressMessage) {
            try {
                await ctx.telegram.editMessageText(
                    progressMessage.chat.id,
                    progressMessage.message_id,
                    null,
                    finalMessage
                );
            } catch (editError) {
                await ctx.reply(finalMessage);
            }
        } else if (!showProgress) {
            await ctx.reply(finalMessage);
        }
        
        return allReviews;
    } catch (error) {
        console.error('Ошибка при получении месячных рецензий:', error);
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
    let message = `📌 *${escapeMarkdown(cleanText(review.title || 'Без названия'))}*\n`;
    message += `👤 Автор: ${escapeMarkdown(cleanText(review.userName || 'Аноним'))}\n`;
    
    // Показываем источник, если он указан
    if (review.source) {
        const sourceEmoji = {
            'Apple Podcasts': '🍎'
        };
        message += `${sourceEmoji[review.source] || '📱'} Источник: ${review.source}\n`;
    } else {
        message += `🌍 Страна: ${review.countryName || 'Неизвестно'} (${review.countryCode || '?'})\n`;
    }
    
    if (review.score !== null && review.score !== undefined) {
        message += `⭐ Оценка: ${'★'.repeat(review.score || 0)}${'☆'.repeat(5 - (review.score || 0))} (${review.score || 0}/5)\n`;
    }
    
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
    
    message += `${escapeMarkdown(cleanText(review.text || 'Без комментария'))}`;
    
    return message;
}

// Функция для получения максимального количества рецензий из всех источников
async function getAllPossibleReviews(ctx) {
    try {
        console.log('Получение максимального количества рецензий...');
        
        const allReviews = [];
        let processedCountries = 0;
        let totalCountries = COUNTRIES.length;
        
        // Отправляем начальное сообщение о прогрессе
        const progressMessage = await ctx.reply(`🌍 Собираю ВСЕ доступные рецензии из Apple Podcasts...\nПроверяю ${totalCountries} стран, несколько страниц в каждой. Это займет 3-5 минут.`);
        
        // Получаем рецензии из каждой страны (несколько страниц)
        for (const country of COUNTRIES) {
            try {
                console.log(`Получение всех рецензий из ${country.name} (${country.code})...`);
                
                // Получаем первые 3 страницы рецензий из каждой страны
                for (let page = 1; page <= 3; page++) {
                    try {
                        const reviews = await store.reviews({
                            id: PODCAST_ID,
                            country: country.code,
                            page: page,
                            sort: store.sort.RECENT
                        });

                        if (reviews.length === 0) break; // Если на странице нет рецензий, прекращаем

                        // Добавляем информацию о стране к каждой рецензии
                        const reviewsWithCountry = reviews.map(review => ({
                            ...review,
                            countryCode: country.code,
                            countryName: country.name
                        }));
                        
                        allReviews.push(...reviewsWithCountry);
                        console.log(`Получено ${reviews.length} рецензий со страницы ${page} из ${country.name}`);
                        
                        // Небольшая задержка между страницами
                        await new Promise(resolve => setTimeout(resolve, 100));
                    } catch (pageError) {
                        console.error(`Ошибка получения страницы ${page} из ${country.name}:`, pageError.message);
                        break; // Прекращаем получение страниц для этой страны
                    }
                }
                
                processedCountries++;
                
                // Обновляем прогресс каждые 5 стран
                if (processedCountries % 5 === 0 || processedCountries === totalCountries) {
                    try {
                        await ctx.telegram.editMessageText(
                            progressMessage.chat.id,
                            progressMessage.message_id,
                            null,
                            `🌍 Сбор всех рецензий: ${processedCountries}/${totalCountries} стран обработано\n📊 Собрано ${allReviews.length} рецензий`
                        );
                    } catch (editError) {
                        // Игнорируем ошибки редактирования сообщения
                    }
                }
                
                // Небольшая задержка между странами
                await new Promise(resolve => setTimeout(resolve, 150));
                
            } catch (countryError) {
                console.error(`Ошибка при получении рецензий из ${country.name}:`, countryError.message);
                processedCountries++;
            }
        }
        
        // Убираем дубликаты рецензий (по ID)
        const uniqueReviews = allReviews.filter((review, index, self) => 
            index === self.findIndex(r => r.id === review.id)
        );
        
        // Сортируем все рецензии по дате (новые первыми)
        uniqueReviews.sort((a, b) => {
            const dateA = new Date(a.updated || 0);
            const dateB = new Date(b.updated || 0);
            return dateB - dateA;
        });
        
        console.log(`Всего собрано ${allReviews.length} рецензий, уникальных: ${uniqueReviews.length}`);
        
        // Финальное сообщение о завершении поиска
        try {
            await ctx.telegram.editMessageText(
                progressMessage.chat.id,
                progressMessage.message_id,
                null,
                `✅ Сбор завершен!\n📊 Проверено ${totalCountries} стран (по 3 страницы каждая)\n📝 Собрано ${allReviews.length} рецензий\n🔄 Уникальных: ${uniqueReviews.length} рецензий`
            );
        } catch (editError) {
            // Игнорируем ошибки редактирования сообщения
        }
        
        return uniqueReviews;
    } catch (error) {
        console.error('Ошибка при получении всех рецензий:', error);
        throw error;
    }
}

// Функция для правильного склонения числительных
function getCorrectForm(number, forms) {
    const n = Math.abs(number) % 100;
    const n1 = n % 10;
    
    if (n > 10 && n < 20) return forms[2];
    if (n1 > 1 && n1 < 5) return forms[1];
    if (n1 === 1) return forms[0];
    return forms[2];
}

// Функция для парсинга продолжительности в секундах
function parseDurationToSeconds(durationText) {
    if (!durationText) return 0;
    
    if (/^\d+$/.test(durationText)) {
        return parseInt(durationText);
    }
    
    const parts = durationText.split(':').map(p => parseInt(p)).reverse();
    let seconds = 0;
    
    if (parts[0]) seconds += parts[0];
    if (parts[1]) seconds += parts[1] * 60;
    if (parts[2]) seconds += parts[2] * 3600;
    
    return seconds;
}

// Функция для получения ссылки на эпизод с podcast.ru
async function getPodcastRuEpisodeLink(episodeTitle) {
    try {
        const url = 'https://podcast.ru/1371411915/e';
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        // Ищем ссылки на эпизоды
        const episodes = [];
        $('a[href*="/e/"]').each((i, element) => {
            const $link = $(element);
            const href = $link.attr('href');
            const title = $link.text().trim() || $link.find('*').text().trim();
            
            if (href && title) {
                episodes.push({
                    title: title,
                    link: href.startsWith('http') ? href : `https://podcast.ru${href}`
                });
            }
        });
        
        // Ищем эпизод по названию (частичное совпадение)
        const cleanEpisodeTitle = episodeTitle.toLowerCase().replace(/[^\w\s]/g, '');
        const matchingEpisode = episodes.find(ep => {
            const cleanTitle = ep.title.toLowerCase().replace(/[^\w\s]/g, '');
            return cleanTitle.includes(cleanEpisodeTitle.substring(0, 20)) || 
                   cleanEpisodeTitle.includes(cleanTitle.substring(0, 20));
        });
        
        return matchingEpisode ? matchingEpisode.link : null;
        
    } catch (error) {
        console.error('Ошибка парсинга podcast.ru:', error);
        return null;
    }
}

// Функция для загрузки/сохранения статистики
async function loadStats() {
    try {
        const data = await fs.readFile(STATS_FILE, 'utf8');
        const stats = JSON.parse(data);
        
        // Преобразуем строку даты обратно в объект Date
        if (stats.startDate && typeof stats.startDate === 'string') {
            stats.startDate = new Date(stats.startDate);
        }
        
        return stats;
    } catch (error) {
        // Если файл не существует, создаем базовую статистику
        const initialStats = {
            ...PODCAST_STATS,
            lastEpisodeId: null,
            lastCheck: new Date().toISOString()
        };
        await saveStats(initialStats);
        return initialStats;
    }
}

async function saveStats(stats) {
    try {
        await fs.writeFile(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
    } catch (error) {
        console.error('Ошибка сохранения статистики:', error);
    }
}

// Функции для работы с подписанными чатами
async function loadChats() {
    try {
        const data = await fs.readFile(CHATS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Если файл не существует, создаем пустой список
        const initialChats = { subscribedChats: [] };
        await saveChats(initialChats);
        return initialChats;
    }
}

async function saveChats(chats) {
    try {
        await fs.writeFile(CHATS_FILE, JSON.stringify(chats, null, 2), 'utf8');
    } catch (error) {
        console.error('Ошибка сохранения чатов:', error);
    }
}

async function addChatToSubscriptions(chatId) {
    try {
        const chats = await loadChats();
        if (!chats.subscribedChats.includes(chatId)) {
            chats.subscribedChats.push(chatId);
            await saveChats(chats);
            console.log(`Чат ${chatId} добавлен в подписки`);
        }
    } catch (error) {
        console.error('Ошибка добавления чата:', error);
    }
}

// Функция для отправки сообщения во все подписанные чаты
async function sendToAllChats(message, parseMode = null) {
    try {
        const chats = await loadChats();
        console.log(`Отправка сообщения в ${chats.subscribedChats.length} чатов...`);
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const chatId of chats.subscribedChats) {
            try {
                const options = parseMode ? { parse_mode: parseMode } : {};
                await bot.telegram.sendMessage(chatId, message, options);
                successCount++;
                console.log(`✅ Отправлено в чат ${chatId}`);
            } catch (sendError) {
                errorCount++;
                console.error(`❌ Ошибка отправки в чат ${chatId}:`, sendError.message);
                
                // Если чат заблокировал бота или удален, убираем его из подписок
                if (sendError.description && 
                    (sendError.description.includes('blocked') || 
                     sendError.description.includes('not found') ||
                     sendError.description.includes('deactivated'))) {
                    chats.subscribedChats = chats.subscribedChats.filter(id => id !== chatId);
                    await saveChats(chats);
                    console.log(`🗑️ Удален недоступный чат ${chatId}`);
                }
            }
        }
        
        console.log(`📊 Результат рассылки: ✅ ${successCount} успешно, ❌ ${errorCount} ошибок`);
        return { successCount, errorCount };
        
    } catch (error) {
        console.error('Ошибка массовой рассылки:', error);
        return { successCount: 0, errorCount: 1 };
    }
}

// Функция для расчета времени с начала подкаста (правильный календарный расчет)
function calculateTimeSinceStart(startDate, currentDate) {
    let years = currentDate.getFullYear() - startDate.getFullYear();
    let months = currentDate.getMonth() - startDate.getMonth();
    let days = currentDate.getDate() - startDate.getDate();
    
    // Корректируем, если дни отрицательные
    if (days < 0) {
        months--;
        const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
        days += lastMonth.getDate();
    }
    
    // Корректируем, если месяцы отрицательные
    if (months < 0) {
        years--;
        months += 12;
    }
    
    return { years, months, days };
}

// Функция для форматирования уведомления о новом эпизоде
async function formatNewEpisodeMessage(stats, newEpisode) {
    const episodeCount = stats.totalEpisodes;
    
    // Точный расчет часов и минут
    const totalMinutes = Math.round(stats.totalHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    // Правильные склонения
    const hourForm = getCorrectForm(hours, ['час', 'часа', 'часов']);
    const minuteForm = getCorrectForm(minutes, ['минуту', 'минуты', 'минут']);
    
    // Формируем текст времени
    let timeText = `${hours} ${hourForm}`;
    if (minutes > 0) {
        timeText += ` ${minutes} ${minuteForm}`;
    }
    
    // Расчет времени с начала
    const timeSince = calculateTimeSinceStart(stats.startDate, new Date(newEpisode.pubDate));
    const yearForm = getCorrectForm(timeSince.years, ['год', 'года', 'лет']);
    const monthForm = getCorrectForm(timeSince.months, ['месяц', 'месяца', 'месяцев']);
    const dayForm = getCorrectForm(timeSince.days, ['день', 'дня', 'дней']);
    
    let durationText = '';
    if (timeSince.years > 0) durationText += `${timeSince.years} ${yearForm}`;
    if (timeSince.months > 0) {
        if (durationText) durationText += ' ';
        durationText += `${timeSince.months} ${monthForm}`;
    }
    if (timeSince.days > 0) {
        if (durationText) durationText += ' ';
        durationText += `${timeSince.days} ${dayForm}`;
    }
    
    // Получаем ссылку на эпизод с podcast.ru
    let episodeLink = '';
    try {
        const podcastRuLink = await getPodcastRuEpisodeLink(newEpisode.title);
        if (podcastRuLink) {
            episodeLink = `\n\nСлушать: ${podcastRuLink}`;
        }
    } catch (error) {
        console.error('Ошибка получения ссылки podcast.ru:', error);
    }
    
    return `*Вышел новый выпуск*\n\nЭто ваш ${episodeCount}-й выпуск, вы записали уже ${timeText} подкастов. Вы делаете этот подкаст ${durationText}.${episodeLink}`;
}

// Функция для проверки новых эпизодов
async function checkForNewEpisodes(testCtx = null) {
    try {
        const logMsg = (msg) => {
            console.log(msg);
            if (testCtx) testCtx.reply(`📝 ${msg}`);
        };
        
        logMsg('Проверка новых эпизодов...');
        
        const stats = await loadStats();
        logMsg(`Загружена статистика: ${stats.totalEpisodes} эпизодов, lastEpisodeId: ${stats.lastEpisodeId || 'НЕ УСТАНОВЛЕН'}`);
        
        const feed = await parser.parseURL(RSS_FEED_URL);
        logMsg(`RSS загружен: ${feed.items.length} эпизодов в ленте`);
        
        if (!feed.items || feed.items.length === 0) {
            logMsg('RSS-лента пуста');
            return;
        }
        
        // Берем самый новый эпизод
        const latestEpisode = feed.items[0];
        logMsg(`Последний эпизод в RSS: "${latestEpisode.title}" (GUID: ${latestEpisode.guid})`);
        
        // Проверяем, новый ли это эпизод
        if (stats.lastEpisodeId === latestEpisode.guid) {
            logMsg('Этот эпизод уже обработан ранее');
            return;
        }
        
        logMsg(`НОВЫЙ ЭПИЗОД ОБНАРУЖЕН! Предыдущий ID: ${stats.lastEpisodeId}, новый ID: ${latestEpisode.guid}`);
        
        // Проверяем, что это не трейлер и длиннее 5 минут
        const title = latestEpisode.title?.toLowerCase() || '';
        const isTrailer = title.includes('трейлер') || title.includes('trailer');
        const duration = parseDurationToSeconds(latestEpisode.itunes?.duration);
        const minutes = duration / 60;
        
        logMsg(`Проверка эпизода: трейлер=${isTrailer}, продолжительность=${Math.round(minutes)} минут`);
        
        if (isTrailer || minutes < 5) {
            logMsg(`Пропускаем: "${latestEpisode.title}" (трейлер или <5 мин)`);
            // Обновляем ID последнего эпизода, но не статистику
            stats.lastEpisodeId = latestEpisode.guid;
            await saveStats(stats);
            logMsg('Статистика обновлена (ID сохранен, но счетчики не изменены)');
            return;
        }
        
        logMsg(`✅ Эпизод прошел проверки! Обновляю статистику...`);
        
        // Обновляем статистику
        const oldEpisodes = stats.totalEpisodes;
        const oldHours = stats.totalHours;
        
        stats.totalEpisodes += 1;
        stats.totalHours += duration / 3600; // добавляем часы
        stats.lastEpisodeId = latestEpisode.guid;
        stats.lastCheck = new Date().toISOString();
        
        await saveStats(stats);
        
        logMsg(`Статистика обновлена: ${oldEpisodes} → ${stats.totalEpisodes} эпизодов, ${oldHours.toFixed(2)} → ${stats.totalHours.toFixed(2)} часов`);
        
        // Формируем сообщение
        logMsg('Формирую уведомление...');
        const message = await formatNewEpisodeMessage(stats, latestEpisode);
        
        if (testCtx) {
            await testCtx.reply('📤 Тестовое уведомление:\n\n' + message, { parse_mode: 'Markdown' });
        } else {
            logMsg('Отправляю уведомление во все чаты...');
            const sendResult = await sendToAllChats(message, 'Markdown');
            logMsg(`Рассылка завершена: ${sendResult.successCount} успешно, ${sendResult.errorCount} ошибок`);
        }
        
    } catch (error) {
        const errorMsg = `Ошибка проверки новых эпизодов: ${error.message}`;
        console.error(errorMsg);
        if (testCtx) testCtx.reply(`❌ ${errorMsg}`);
    }
}

// Функция для отправки месячного отчета
async function sendMonthlyReport(testCtx = null) {
    try {
        if (testCtx) await testCtx.reply('📅 Начинаю тест месячного отчета...');
        console.log('Отправка месячного отчета...');
        
        // Получаем рецензии за прошлый месяц
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const periodText = `${lastMonth.toLocaleDateString('ru-RU')} - ${thisMonth.toLocaleDateString('ru-RU')}`;
        console.log(`Ищем рецензии за период: ${periodText}`);
        if (testCtx) await testCtx.reply(`🔍 Ищу рецензии за период: ${periodText}`);
        
        // Создаем контекст для получения рецензий
        const tempCtx = testCtx || {
            reply: (msg) => { console.log('Прогресс:', msg); return Promise.resolve({ chat: { id: 'temp' }, message_id: 1 }); },
            telegram: {
                editMessageText: () => Promise.resolve()
            }
        };
        
        const monthlyReviews = await getMonthlyReviews(tempCtx, false); // Без показа прогресса для автоматического отчета
        
        // Фильтруем рецензии именно за прошлый месяц
        const lastMonthReviews = monthlyReviews.filter(review => {
            if (!review.updated) return false;
            const reviewDate = new Date(review.updated);
            return reviewDate >= lastMonth && reviewDate < thisMonth;
        });
        
        console.log(`Найдено ${lastMonthReviews.length} рецензий за прошлый месяц`);
        
        // Формируем сообщение с правильными склонениями
        const totalCountries = COUNTRIES.length;
        const storeForm = getCorrectForm(totalCountries, ['стор', 'стора', 'сторов']);
        const reviewForm = getCorrectForm(lastMonthReviews.length, ['рецензию', 'рецензии', 'рецензий']);
        
        let message;
        if (lastMonthReviews.length === 0) {
            const randomPhrases = [
                'Это печально!',
                'Эхх.',
                'Дичь!',
                'Че за бред.',
                'С этим надо что-то делать.',
                'Бывает.'
            ];
            const randomPhrase = randomPhrases[Math.floor(Math.random() * randomPhrases.length)];
            message = `С началом нового месяца вас! Я проверила ${totalCountries} ${storeForm} и не нашла ни одной рецензии. ${randomPhrase}`;
        } else {
            const reviewWord = lastMonthReviews.length === 1 ? 'она' : 'они';
            message = `С началом нового месяца вас! Я проверила ${totalCountries} ${storeForm} и нашла ${lastMonthReviews.length} ${reviewForm} за прошлый месяц. Вот ${reviewWord}:`;
        }
        
        console.log('Сообщение для отправки:', message);
        if (testCtx) {
            await testCtx.reply(`📝 Итоговое сообщение для месячного отчета:\n${message}`);
            
            if (lastMonthReviews.length > 0) {
                await testCtx.reply(`📋 Примеры рецензий (первые 3):`);
                for (let i = 0; i < Math.min(3, lastMonthReviews.length); i++) {
                    const review = lastMonthReviews[i];
                    await testCtx.reply(`${i + 1}. "${review.title}" от ${review.userName} (${review.countryName})`);
                }
                if (lastMonthReviews.length > 3) {
                    await testCtx.reply(`... и еще ${lastMonthReviews.length - 3} рецензий`);
                }
            }
        }
        
        // TODO: Отправка во все чаты
        // Пока только логируем
        
        return { message, reviews: lastMonthReviews };
        
    } catch (error) {
        console.error('Ошибка отправки месячного отчета:', error);
        if (testCtx) await testCtx.reply(`❌ Ошибка: ${error.message}`);
        throw error;
    }
}

// Функция для проверки, нужно ли отправлять месячный отчет
async function checkMonthlyReport() {
    try {
        const now = new Date();
        
        // Проверяем, что сегодня 1 число месяца
        if (now.getDate() !== 1) {
            return;
        }
        
        // Проверяем, не отправляли ли уже отчет в этом месяце
        const stats = await loadStats();
        const lastReportDate = stats.lastMonthlyReport ? new Date(stats.lastMonthlyReport) : null;
        
        if (lastReportDate && 
            lastReportDate.getFullYear() === now.getFullYear() && 
            lastReportDate.getMonth() === now.getMonth()) {
            console.log('Месячный отчет уже отправлен в этом месяце');
            return;
        }
        
        console.log('Пора отправить месячный отчет!');
        
        // Отправляем отчет (без тестового контекста)
        await sendMonthlyReport();
        
        // Обновляем дату последнего отчета
        stats.lastMonthlyReport = now.toISOString();
        await saveStats(stats);
        
    } catch (error) {
        console.error('Ошибка проверки месячного отчета:', error);
    }
}

// Обработка команды /start
bot.start(async (ctx) => {
    // Автоматически подписываем чат на уведомления
    await addChatToSubscriptions(ctx.chat.id);
    
    ctx.reply(
        'Привет! Я бот для получения рецензий подкаста "Два по цене одного".\n\n' +
        'Команды:\n' +
        '/reviews - получить последние 20 рецензий из Apple Podcasts\n' +
        '/month - получить все рецензии за последний месяц\n' +
        '/all - получить ВСЕ доступные рецензии (может быть много!)\n' +
        '/help - показать справку\n\n' +
        '🔔 Вы автоматически подписаны на уведомления о новых эпизодах!'
    );
});

// Обработка команды /help
bot.help((ctx) => {
    ctx.reply(
        'Доступные команды:\n\n' +
        '🍎 /reviews - последние 20 рецензий из Apple Podcasts\n' +
        '🗓️ /month - все рецензии за последний месяц\n' +
        '🌍 /all - ВСЕ доступные рецензии (76 стран × 3 страницы)\n' +
        '❓ /help - показать эту справку\n\n' +
        '🔧 Тестовые команды:\n' +
        '🧪 /run_tests - полное тестирование системы\n' +
        '🔍 /check_rss - диагностика RSS-мониторинга\n' +
        '📺 /test_episode - тест уведомлений о новых эпизодах\n' +
        '📅 /test_monthly - тест месячных отчетов\n\n' +
        'Подкаст: "Два по цене одного"\n' +
        'Источники: 🍎 Apple Podcasts (76 стран)'
    );
});

// Обработка команды /reviews
bot.command('reviews', async (ctx) => {
    try {
        // Автоматически подписываем чат на уведомления
        await addChatToSubscriptions(ctx.chat.id);
        
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

// Обработка команды /month
bot.command('month', async (ctx) => {
    try {
        // Автоматически подписываем чат на уведомления
        await addChatToSubscriptions(ctx.chat.id);
        
        // Получаем месячные рецензии (с показом прогресса)
        const reviews = await getMonthlyReviews(ctx, true);
        
        // Если рецензий нет, функция уже отправила финальное сообщение с рандомной фразой
        if (reviews.length === 0) {
            return;
        }
        
        // Если рецензии есть, функция уже отправила сообщение "Вот они:", теперь отправляем рецензии
        
        // Отправляем каждую рецензию отдельным сообщением
        for (let i = 0; i < reviews.length; i++) {
            const reviewMessage = formatReviewMessage(reviews[i], i);
            
            try {
                // Отправляем с Markdown режимом для правильного форматирования
                await ctx.reply(reviewMessage, { parse_mode: 'Markdown' });
                
                // Небольшая задержка между сообщениями, чтобы не превысить лимиты Telegram
                if (i < reviews.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 200));
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
        
    } catch (error) {
        console.error('Ошибка при обработке команды /month:', error);
        await ctx.reply('Произошла ошибка при получении месячных рецензий. Попробуйте позже.');
    }
});

// Обработка команды /all
bot.command('all', async (ctx) => {
    try {
        // Получаем ВСЕ возможные рецензии
        const reviews = await getAllPossibleReviews(ctx);
        
        if (reviews.length === 0) {
            await ctx.reply('Рецензии не найдены.');
            return;
        }
        
        // Предупреждаем о большом количестве сообщений
        if (reviews.length > 100) {
            const estimatedMinutes = Math.ceil(reviews.length * 1.5 / 60 + Math.floor(reviews.length / 20) * 10 / 60);
            await ctx.reply(`⚠️ *Внимание!* Найдено ${reviews.length} рецензий\\!\n\nОтправка займет ~${estimatedMinutes} минут с паузами для избежания лимитов Telegram\\.\n\nНачинаю отправку\\.\\.\\.`, { parse_mode: 'MarkdownV2' });
        } else {
            await ctx.reply(`🌍 *Все найденные рецензии: ${reviews.length} штук*\n\nОтправляю по одной рецензии\\.\\.\\.`, { parse_mode: 'MarkdownV2' });
        }
        
        // Отправляем каждую рецензию отдельным сообщением с улучшенной обработкой лимитов
        for (let i = 0; i < reviews.length; i++) {
            const reviewMessage = formatReviewMessage(reviews[i], i);
            
            try {
                // Отправляем с Markdown режимом для правильного форматирования
                await ctx.reply(reviewMessage, { parse_mode: 'Markdown' });
                
                // Увеличенная задержка между сообщениями для избежания лимитов
                if (i < reviews.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 секунды
                }
                
                // Каждые 20 сообщений делаем длинную паузу
                if ((i + 1) % 20 === 0 && i < reviews.length - 1) {
                    await ctx.reply(`⏸️ Пауза для избежания лимитов Telegram... Отправлено ${i + 1} из ${reviews.length}`);
                    await new Promise(resolve => setTimeout(resolve, 10000)); // 10 секунд пауза
                }
                
                // Каждые 50 рецензий показываем подробный прогресс
                if ((i + 1) % 50 === 0 && i < reviews.length - 1) {
                    const remaining = reviews.length - (i + 1);
                    const estimatedMinutes = Math.ceil(remaining * 1.5 / 60);
                    await ctx.reply(`📊 Прогресс: ${i + 1}/${reviews.length} отправлено\n⏱️ Осталось ~${estimatedMinutes} минут`);
                }
                
            } catch (msgError) {
                console.error(`Ошибка отправки рецензии ${i + 1}:`, msgError);
                
                // Проверяем, не превышен ли лимит запросов
                if (msgError.description && msgError.description.includes('Too Many Requests')) {
                    const retryAfter = msgError.parameters?.retry_after || 60;
                    await ctx.reply(`⚠️ Превышен лимит Telegram API. Пауза на ${retryAfter} секунд...`);
                    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                    i--; // Повторяем отправку этой рецензии
                    continue;
                }
                
                // Если Markdown не работает, отправляем без форматирования
                try {
                    const plainMessage = reviewMessage.replace(/\*/g, '');
                    await ctx.reply(plainMessage);
                } catch (plainError) {
                    console.error(`Критическая ошибка отправки рецензии ${i + 1}:`, plainError);
                    
                    // Если и простое сообщение не отправляется, делаем паузу и пропускаем
                    if (plainError.description && plainError.description.includes('Too Many Requests')) {
                        const retryAfter = plainError.parameters?.retry_after || 60;
                        await ctx.reply(`⚠️ Критический лимит API. Пауза на ${retryAfter} секунд...`);
                        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                        i--; // Повторяем отправку этой рецензии
                        continue;
                    }
                    
                    // В крайнем случае пропускаем эту рецензию
                    await ctx.reply(`❌ Не удалось отправить рецензию ${i + 1}. Пропускаю...`);
                }
                
                // Дополнительная пауза после ошибки
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        
        await ctx.reply(`✅ Все ${reviews.length} рецензий отправлены!\n\n📊 Статистика:\n🌍 Стран проверено: 73\n📄 Страниц проверено: до 219\n📝 Уникальных рецензий: ${reviews.length}`);
        
    } catch (error) {
        console.error('Ошибка при обработке команды /all:', error);
        await ctx.reply('Произошла ошибка при получении всех рецензий. Попробуйте позже.');
    }
});

// Скрытая команда для тестирования уведомлений о новых эпизодах
bot.command('test_episode', async (ctx) => {
    try {
        await ctx.reply('Тестирую систему уведомлений на основе реального последнего эпизода...');
        
        const stats = await loadStats();
        const feed = await parser.parseURL(RSS_FEED_URL);
        
        if (!feed.items || feed.items.length === 0) {
            await ctx.reply('Ошибка: RSS-лента пуста');
            return;
        }
        
        // Берем реальный последний эпизод из RSS
        const latestEpisode = feed.items[0];
        
        // Проверяем его параметры
        const duration = parseDurationToSeconds(latestEpisode.itunes?.duration);
        const minutes = Math.round(duration / 60);
        
        await ctx.reply(`Последний эпизод в RSS:\n"${latestEpisode.title}"\nПродолжительность: ${minutes} минут`);
        
        // Показываем уведомление на основе ТЕКУЩЕЙ статистики (без добавления эпизода)
        const testStats = {
            ...stats,
            startDate: new Date(stats.startDate)
        };
        
        const message = await formatNewEpisodeMessage(testStats, latestEpisode);
        
        await ctx.reply('Тестовое уведомление (как выглядит для последнего эпизода):\n\n' + message, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('Ошибка тестирования:', error);
        await ctx.reply('Ошибка при тестировании системы уведомлений.');
    }
});

// Скрытая команда для тестирования месячного отчета
bot.command('test_monthly', async (ctx) => {
    try {
        await ctx.reply('🧪 Тестирую месячный отчет с подробными логами...');
        
        // Принудительно запускаем отправку месячного отчета с передачей контекста
        const result = await sendMonthlyReport(ctx);
        
        await ctx.reply(`✅ Тест завершен!\n\n📋 Результат:\n• Сообщение: готово\n• Рецензий найдено: ${result.reviews.length}\n• Логи показаны выше`);
        
    } catch (error) {
        console.error('Ошибка тестирования месячного отчета:', error);
        await ctx.reply(`❌ Ошибка при тестировании: ${error.message}`);
    }
});

// Скрытая команда для диагностики мониторинга эпизодов
bot.command('check_rss', async (ctx) => {
    try {
        await ctx.reply('🔍 Проверяю систему мониторинга RSS...');
        
        // Проверяем RSS-ленту
        try {
            const feed = await parser.parseURL(RSS_FEED_URL);
            await ctx.reply(`📡 RSS-лента доступна. Найдено ${feed.items.length} эпизодов`);
            
            if (feed.items.length > 0) {
                const latest = feed.items[0];
                const duration = parseDurationToSeconds(latest.itunes?.duration);
                const minutes = Math.round(duration / 60);
                
                await ctx.reply(`🎧 Последний эпизод:\n"${latest.title}"\nДата: ${new Date(latest.pubDate).toLocaleString('ru-RU')}\nПродолжительность: ${minutes} минут\nGUID: ${latest.guid}`);
            }
        } catch (rssError) {
            await ctx.reply(`❌ Ошибка RSS: ${rssError.message}`);
        }
        
        // Проверяем файл статистики
        try {
            const stats = await loadStats();
            await ctx.reply(`📊 Статистика загружена:\n• Эпизодов: ${stats.totalEpisodes}\n• Часов: ${Math.round(stats.totalHours * 60) / 60}\n• Последний ID: ${stats.lastEpisodeId || 'не установлен'}\n• Последняя проверка: ${stats.lastCheck ? new Date(stats.lastCheck).toLocaleString('ru-RU') : 'никогда'}`);
        } catch (statsError) {
            await ctx.reply(`❌ Ошибка статистики: ${statsError.message}`);
        }
        
        // Запускаем ручную проверку с подробным логированием
        await ctx.reply('🔄 Запускаю ручную проверку новых эпизодов с подробными логами...');
        await checkForNewEpisodes(ctx);
        await ctx.reply('✅ Ручная проверка завершена.');
        
    } catch (error) {
        console.error('Ошибка диагностики:', error);
        await ctx.reply(`❌ Ошибка диагностики: ${error.message}`);
    }
});

// Команда для немедленной отправки уведомления о последнем эпизоде
bot.command('send_latest', async (ctx) => {
    try {
        await ctx.reply('📤 Отправляю уведомление о последнем эпизоде во все чаты...');
        
        // Получаем последний эпизод из RSS
        const feed = await parser.parseURL(RSS_FEED_URL);
        const latestEpisode = feed.items[0];
        
        // Получаем текущую статистику и симулируем обновление
        const stats = await loadStats();
        const duration = parseDurationToSeconds(latestEpisode.itunes?.duration);
        
        const updatedStats = {
            ...stats,
            totalEpisodes: stats.totalEpisodes + 1,
            totalHours: stats.totalHours + (duration / 3600),
            startDate: new Date(stats.startDate)
        };
        
        // Формируем уведомление
        const message = await formatNewEpisodeMessage(updatedStats, latestEpisode);
        
        // Отправляем во все чаты
        const result = await sendToAllChats(message, 'Markdown');
        
        await ctx.reply(`✅ Уведомление отправлено!\n📊 Результат: ${result.successCount} чатов получили сообщение, ${result.errorCount} ошибок`);
        
        // Обновляем статистику после успешной отправки
        updatedStats.lastEpisodeId = latestEpisode.guid;
        updatedStats.lastCheck = new Date().toISOString();
        await saveStats(updatedStats);
        
        await ctx.reply('📊 Статистика обновлена после отправки уведомления');
        
    } catch (error) {
        console.error('Ошибка отправки уведомления:', error);
        await ctx.reply(`❌ Ошибка: ${error.message}`);
    }
});

// Система тестирования всех функций бота
bot.command('run_tests', async (ctx) => {
    try {
        await ctx.reply('🧪 Запускаю полное тестирование системы...\n\nЭто займет 2-3 минуты. Буду отправлять отчеты по каждому тесту.');
        
        const testResults = [];
        let testNumber = 1;
        
        // Тест 1: RSS-мониторинг
        try {
            await ctx.reply(`🧪 Тест ${testNumber++}: RSS-мониторинг`);
            const feed = await parser.parseURL(RSS_FEED_URL);
            const latest = feed.items[0];
            const duration = parseDurationToSeconds(latest.itunes?.duration);
            
            testResults.push({
                name: 'RSS-мониторинг',
                status: '✅ ПРОШЕЛ',
                details: `${feed.items.length} эпизодов, последний "${latest.title}" (${Math.round(duration/60)} мин)`
            });
            await ctx.reply('✅ RSS работает корректно');
        } catch (error) {
            testResults.push({
                name: 'RSS-мониторинг', 
                status: '❌ ОШИБКА',
                details: error.message
            });
            await ctx.reply(`❌ Ошибка RSS: ${error.message}`);
        }
        
        // Тест 2: Система статистики
        try {
            await ctx.reply(`🧪 Тест ${testNumber++}: Система статистики`);
            const stats = await loadStats();
            const isDateValid = stats.startDate instanceof Date;
            
            testResults.push({
                name: 'Система статистики',
                status: isDateValid ? '✅ ПРОШЕЛ' : '⚠️ ПРОБЛЕМА',
                details: `${stats.totalEpisodes} эпизодов, ${Math.round(stats.totalHours*60)/60} часов, дата: ${isDateValid ? 'OK' : 'НЕ Date объект'}`
            });
            await ctx.reply(isDateValid ? '✅ Статистика работает' : '⚠️ Проблема с датой в статистике');
        } catch (error) {
            testResults.push({
                name: 'Система статистики',
                status: '❌ ОШИБКА', 
                details: error.message
            });
            await ctx.reply(`❌ Ошибка статистики: ${error.message}`);
        }
        
        // Тест 3: Форматирование уведомлений
        try {
            await ctx.reply(`🧪 Тест ${testNumber++}: Форматирование уведомлений`);
            const stats = await loadStats();
            const testEpisode = {
                title: 'Тестовый эпизод',
                pubDate: new Date().toISOString(),
                itunes: { duration: '3000' }
            };
            
            const message = await formatNewEpisodeMessage(stats, testEpisode);
            const hasCorrectFormat = message.includes('*Вышел новый выпуск*') && 
                                   message.includes('-й выпуск') &&
                                   message.includes('часов') || message.includes('час');
            
            testResults.push({
                name: 'Форматирование уведомлений',
                status: hasCorrectFormat ? '✅ ПРОШЕЛ' : '❌ ОШИБКА',
                details: hasCorrectFormat ? 'Формат корректный' : 'Неверный формат сообщения'
            });
            await ctx.reply(hasCorrectFormat ? '✅ Форматирование работает' : '❌ Ошибка форматирования');
        } catch (error) {
            testResults.push({
                name: 'Форматирование уведомлений',
                status: '❌ ОШИБКА',
                details: error.message
            });
            await ctx.reply(`❌ Ошибка форматирования: ${error.message}`);
        }
        
        // Тест 4: Склонения
        try {
            await ctx.reply(`🧪 Тест ${testNumber++}: Система склонений`);
            const tests = [
                { num: 1, expected: 'стор', forms: ['стор', 'стора', 'сторов'] },
                { num: 2, expected: 'стора', forms: ['стор', 'стора', 'сторов'] },
                { num: 5, expected: 'сторов', forms: ['стор', 'стора', 'сторов'] },
                { num: 21, expected: 'стор', forms: ['стор', 'стора', 'сторов'] }
            ];
            
            let allCorrect = true;
            for (const test of tests) {
                const result = getCorrectForm(test.num, test.forms);
                if (result !== test.expected) {
                    allCorrect = false;
                    break;
                }
            }
            
            testResults.push({
                name: 'Система склонений',
                status: allCorrect ? '✅ ПРОШЕЛ' : '❌ ОШИБКА',
                details: allCorrect ? 'Все склонения корректны' : 'Ошибки в склонениях'
            });
            await ctx.reply(allCorrect ? '✅ Склонения работают' : '❌ Ошибка склонений');
        } catch (error) {
            testResults.push({
                name: 'Система склонений',
                status: '❌ ОШИБКА',
                details: error.message
            });
            await ctx.reply(`❌ Ошибка склонений: ${error.message}`);
        }
        
        // Тест 5: Podcast.ru парсинг
        try {
            await ctx.reply(`🧪 Тест ${testNumber++}: Парсинг podcast.ru`);
            const testLink = await getPodcastRuEpisodeLink('Подались на сотни вакансий');
            
            testResults.push({
                name: 'Парсинг podcast.ru',
                status: testLink ? '✅ ПРОШЕЛ' : '⚠️ НЕ НАЙДЕН',
                details: testLink ? `Ссылка: ${testLink}` : 'Ссылка не найдена'
            });
            await ctx.reply(testLink ? `✅ Парсинг работает: ${testLink}` : '⚠️ Ссылка не найдена');
        } catch (error) {
            testResults.push({
                name: 'Парсинг podcast.ru',
                status: '❌ ОШИБКА',
                details: error.message
            });
            await ctx.reply(`❌ Ошибка парсинга: ${error.message}`);
        }
        
        // Финальный отчет
        await ctx.reply('📊 ИТОГОВЫЙ ОТЧЕТ ТЕСТИРОВАНИЯ:');
        
        let passedTests = 0;
        let totalTests = testResults.length;
        
        for (const test of testResults) {
            await ctx.reply(`${test.status} ${test.name}\n${test.details}`);
            if (test.status.includes('✅')) passedTests++;
        }
        
        const overallStatus = passedTests === totalTests ? '🎉 ВСЕ ТЕСТЫ ПРОШЛИ' : 
                             passedTests > totalTests / 2 ? '⚠️ ЕСТЬ ПРОБЛЕМЫ' : '🚨 КРИТИЧЕСКИЕ ОШИБКИ';
        
        await ctx.reply(`\n${overallStatus}\n\n📈 Результат: ${passedTests}/${totalTests} тестов прошли\n\n${passedTests === totalTests ? 'Система готова к продакшену!' : 'Требуются исправления!'}`);
        
    } catch (error) {
        console.error('Ошибка системы тестирования:', error);
        await ctx.reply(`❌ Критическая ошибка тестирования: ${error.message}`);
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
    
    // Инициализируем статистику
    loadStats().then(stats => {
        console.log(`📊 Текущая статистика: ${stats.totalEpisodes} эпизодов, ${Math.round(stats.totalHours)} часов`);
    });
    
    // Запускаем мониторинг новых эпизодов каждые 10 минут
    setInterval(checkForNewEpisodes, 10 * 60 * 1000);
    console.log('🔍 Мониторинг новых эпизодов запущен (проверка каждые 10 минут)');
    
    // Запускаем проверку месячных отчетов каждые 6 часов
    setInterval(checkMonthlyReport, 6 * 60 * 60 * 1000);
    console.log('📅 Мониторинг месячных отчетов запущен (проверка каждые 6 часов)');
    
    // Проверяем сразу при запуске
    checkMonthlyReport();
    
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
