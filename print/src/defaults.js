// Default newspaper configuration. The user can change everything in the
// "Редакция" dialog; the result is stored in userData/settings.json.

const CLASSICAL = "филармон|оркестр|симфон|опер[аеыуо]|балет|дирижер|дирижёр|пианист|скрипач|виолончел|консерватор|классическ\\w* музык|камерн\\w* музык|большой театр|мариинск";
const FISHING = "рыбалк|рыболов|рыбак|рыбач|улов[аеуы]?[ ,.]|клёв|спиннинг|удочк|удильщик|подлёдн|подледн|нерест|ловл[яиюе] рыб|рыбнадзор|карпфишинг|fishing|angler";
const THEATRE = "(?<!кино)театр|спектакл|постановк|труппа|режиссёр[а-я]* (спектакл|постановк)|«золот[а-я]* маск|золотая маска|мхт|ленком|вахтангов|малый театр|сатирикон|мастерск[а-я]* фоменко|премьер[а-я]* (спектакл|в театре)";
const BOOKS = "книг|издательств|книгоизда|литератур|писател|роман[аеуы]? |поэт|премии? .*(литератур|книж)|non/fiction|ярмарк\\w* книг";

module.exports = {
  version: 4,
  sections: [
    {
      id: "main",
      title: "Главные новости",
      feeds: [
        { name: "ТАСС", url: "https://tass.ru/rss/v2.xml" },
        { name: "Интерфакс", url: "https://www.interfax.ru/rss.asp" },
        { name: "Коммерсантъ", url: "https://www.kommersant.ru/RSS/main.xml" },
        { name: "РИА Новости", url: "https://ria.ru/export/rss2/archive/index.xml" },
        { name: "РБК", url: "https://rssexport.rbc.ru/rbcnews/news/30/full.rss" },
      ],
      filter: "",
      limit: 10,
    },
    {
      id: "publishing",
      title: "Книгоиздание",
      feeds: [
        { name: "Год литературы", url: "https://godliteratury.ru/rss" },
        { name: "Коммерсантъ · Культура", url: "https://www.kommersant.ru/RSS/section-culture.xml" },
        { name: "Лента · Культура", url: "https://lenta.ru/rss/news/culture" },
        { name: "Publishers Weekly", url: "https://www.publishersweekly.com/pw/feeds/recent/index.xml" },
        { name: "Publishing Perspectives", url: "https://publishingperspectives.com/feed/" },
        { name: "Полка", url: "https://t.me/polka_academy" },
        { name: "Канал Константина Мильчина", url: "https://t.me/milchin" },
      ],
      // Only general culture feeds are filtered; dedicated book feeds pass as is.
      filter: BOOKS,
      filterOnly: ["Коммерсантъ · Культура", "Лента · Культура"],
      limit: 8,
    },
    {
      id: "literature",
      title: "Литература",
      feeds: [
        { name: "Год литературы", url: "https://godliteratury.ru/rss" },
        { name: "Literary Hub", url: "https://lithub.com/feed/" },
        { name: "The Guardian · Books", url: "https://www.theguardian.com/books/rss" },
        { name: "NYT · Books", url: "https://rss.nytimes.com/services/xml/rss/nyt/Books.xml" },
      ],
      filter: "",
      limit: 8,
    },
    {
      id: "jazz",
      title: "Джаз",
      feeds: [
        { name: "Jazz.ru", url: "https://www.jazz.ru/feed/" },
        { name: "JazzPeople", url: "https://www.jazzpeople.ru/feed/" },
        { name: "JazzTimes", url: "https://jazztimes.com/feed/" },
        { name: "The Guardian · Jazz", url: "https://www.theguardian.com/music/jazz/rss" },
        { name: "Клуб Алексея Козлова", url: "https://t.me/kozlovclub" },
        { name: "Клуб Игоря Бутмана", url: "https://t.me/butmanclub" },
      ],
      filter: "",
      limit: 7,
      maxAgeDays: 7,
    },
    {
      id: "classical",
      title: "Классическая музыка",
      feeds: [
        { name: "Belcanto.ru", url: "https://www.belcanto.ru/rss" },
        { name: "Новости классической музыки", url: "https://www.classicalmusicnews.ru/feed/" },
        { name: "Музыкальная жизнь", url: "https://muzlifemagazine.ru/feed/" },
        { name: "Slipped Disc", url: "https://slippedisc.com/feed/" },
        { name: "The Guardian · Classical", url: "https://www.theguardian.com/music/classicalmusicandopera/rss" },
        { name: "Коммерсантъ · Культура", url: "https://www.kommersant.ru/RSS/section-culture.xml" },
        { name: "Большой театр", url: "https://t.me/bolshoi_theatre" },
        { name: "Мариинский театр", url: "https://t.me/mariinsky_theatre" },
      ],
      filter: CLASSICAL,
      filterOnly: ["Коммерсантъ · Культура"],
      limit: 8,
      maxAgeDays: 5,
    },
    {
      id: "theatre",
      title: "Театр",
      feeds: [
        { name: "Журнал «Театр.»", url: "https://oteatre.info/feed/" },
        { name: "Театръ", url: "https://t.me/oteatre" },
        { name: "Театр Вахтангова", url: "https://t.me/vakhtangov_theatre" },
        { name: "Ленком", url: "https://t.me/teatrlenkom" },
        { name: "Малый театр", url: "https://t.me/maly_theatre" },
        { name: "Коммерсантъ · Культура", url: "https://www.kommersant.ru/RSS/section-culture.xml" },
        { name: "Лента · Культура", url: "https://lenta.ru/rss/news/culture" },
        { name: "The Guardian · Stage", url: "https://www.theguardian.com/stage/rss" },
      ],
      filter: THEATRE,
      filterOnly: ["Коммерсантъ · Культура", "Лента · Культура"],
      limit: 8,
      maxAgeDays: 5,
    },
    {
      id: "science",
      title: "Наука",
      feeds: [
        { name: "N + 1", url: "https://nplus1.ru/rss" },
        { name: "Naked Science", url: "https://naked-science.ru/feed" },
        { name: "Элементы", url: "https://elementy.ru/rss/news" },
      ],
      filter: "",
      limit: 8,
    },
    {
      id: "fishing",
      title: "Рыбалка",
      feeds: [
        { name: "Carp Today", url: "https://www.carptoday.ru/rss" },
        { name: "Лента", url: "https://lenta.ru/rss/news" },
        { name: "РИА Новости", url: "https://ria.ru/export/rss2/archive/index.xml" },
        { name: "ТАСС", url: "https://tass.ru/rss/v2.xml" },
        { name: "Wired2Fish", url: "https://www.wired2fish.com/feed/" },
        { name: "Fishing World", url: "https://www.fishingworld.com.au/rss" },
        { name: "Carp Today · Telegram", url: "https://t.me/carptoday" },
      ],
      filter: FISHING,
      filterOnly: ["Лента", "РИА Новости", "ТАСС"],
      limit: 8,
      maxAgeDays: 7,
    },
    {
      id: "games",
      title: "Игры и кино",
      feeds: [
        { name: "StopGame", url: "https://stopgame.ru/rss/rss_news.xml" },
        { name: "Игромания", url: "https://www.igromania.ru/rss/news.xml" },
        { name: "KinoNews", url: "https://www.kinonews.ru/rss/" },
        { name: "Film.ru", url: "https://www.film.ru/rss.xml" },
      ],
      filter: "",
      limit: 9,
    },
  ],
  market: {
    title: "Ретро-консоли",
    queries: ["sega mega drive", "dendy", "nintendo nes", "super nintendo", "nintendo 64", "game boy", "playstation 1", "sega dreamcast"],
    perQuery: 6,
    limit: 20,
    maxPrice: 0,
    sources: { youla: true, avito: true },
    // «Ищу»: a lot whose title has all these words and fits the price comes as a notification.
    alerts: [],
  },
  jobs: {
    keywords: ["редактор", "корректор", "автор", "копирайтер"],
    moscow: true,
    remote: true,
    minSalary: 0,
    sources: { hh: true, trudvsem: true },
  },
  weather: { city: "Москва", lat: 55.7558, lon: 37.6173 },
  // Web edition on GitHub Pages. kotoryy.ru itself is served by another
  // server, so the site needs its own subdomain with a CNAME to kotoryy.github.io.
  // Publishing makes the issue public, so it happens only when the reader asks.
  web: { autoPublish: false, domain: "gazeta.kotoryy.ru" },
  // The morning issue: start with Windows into the tray, print by this time, notify.
  morning: { autostart: true, time: "08:00", notify: true },
  // Take «Требуются» from «Биржа труда» and new books from «Литературное обозрение»
  // when those apps are installed on this computer.
  links: { birzha: true, obozrenie: true },
  // Stories already seen leave the paper unless showRead is on.
  reading: { showRead: false },
  // «Меньше такого»: sources and words that never get into the paper.
  muted: { sources: [], words: [] },
};
