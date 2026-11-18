const pdfParse = require('pdf-parse');
const pdfjs = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js');

const MONTH_NAMES = [
    'ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran',
    'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik'
];

const IGNORED_LINES = new Set([
    'pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi', 'pazar',
    'ana yemek', 'yardimci yemek'
]);

const normalizeText = (value = '') => value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0131/g, 'i')
    .replace(/\u015f/g, 's')
    .replace(/\u011f/g, 'g')
    .replace(/\u00fc/g, 'u')
    .replace(/\u00f6/g, 'o')
    .replace(/\u00e7/g, 'c')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();

const parseMonthValue = (value) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;
    return { year: Number(match[1]), month: Number(match[2]) };
};

const getDateForDay = (monthValue, day) => {
    const parsed = parseMonthValue(monthValue);
    if (!parsed) return null;
    const maxDay = new Date(parsed.year, parsed.month, 0).getDate();
    if (day < 1 || day > maxDay) return null;
    return `${parsed.year}-${String(parsed.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const getTodayIso = () => {
    const parts = new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
};

const getNextMonthStart = (monthValue) => {
    const parsed = parseMonthValue(monthValue);
    if (!parsed) return null;
    const nextYear = parsed.month === 12 ? parsed.year + 1 : parsed.year;
    const nextMonth = parsed.month === 12 ? 1 : parsed.month + 1;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
};

const splitItems = (items) => {
    let source = items;
    if (typeof source === 'string' && source.trim().startsWith('[')) {
        try {
            const parsed = JSON.parse(source);
            if (Array.isArray(parsed)) source = parsed;
        } catch {
            source = items;
        }
    }

    const rawItems = Array.isArray(source) ? source : String(source || '')
        .split(/\r?\n|,/)
        .map(item => String(item).trim());
    return mergeMealItemFragments(rawItems.map(cleanMealItem).filter(Boolean));
};

const cleanMealItem = (value = '') => String(value)
    .replace(/[“”„‟‘’‚‛"'`´]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;.,-]+|[\s:;.,-]+$/g, '')
    .trim();

const SOUP_SUFFIXES = new Set(['cor', 'corba', 'corbasi']);
const NON_SOUP_PREFIX_HINTS = new Set([
    'pilav', 'pilavi', 'makarna', 'makarnasi', 'kofte', 'kebabi', 'kebap',
    'sote', 'but', 'dolma', 'musakka', 'manti', 'eriste', 'tavuk', 'pilic',
    'fasulye', 'nohut', 'patates'
]);

const isLikelySoupPrefix = (value) => {
    if (!value || SOUP_SUFFIXES.has(value) || value.includes('corba')) return false;
    const words = value.split(/\s+/).filter(Boolean);
    if (words.length > 2) return false;
    return !words.some(word => NON_SOUP_PREFIX_HINTS.has(word));
};

const shouldJoinWithNext = (current, next) => {
    const normalizedCurrent = normalizeText(current).replace(/[.;:]+$/g, '').replace(/\./g, '');
    const normalizedNext = normalizeText(next).replace(/[.;:]+$/g, '').replace(/\./g, '');
    if (!normalizedCurrent || !normalizedNext) return false;

    const pairRules = [
        { current: isLikelySoupPrefix, next: value => SOUP_SUFFIXES.has(value) },
        { current: value => value.endsWith('suyu'), next: value => ['cor', 'corba', 'corbasi'].includes(value) },
        { current: value => value.endsWith('arasi'), next: value => ['kofte', 'tavuk', 'doner'].includes(value) },
        { current: value => value.endsWith('sos') || value.endsWith('soslu'), next: value => ['mak', 'makarna', 'makarnasi', 'tavuk', 'pilic'].includes(value) },
        { current: value => value.endsWith('seh'), next: value => ['pilav', 'pilavi'].includes(value) },
        { current: value => ['bulgur', 'pirinc'].includes(value), next: value => ['pilav', 'pilavi'].includes(value) },
        { current: value => value === 'sebze', next: value => ['corba', 'corbasi'].includes(value) },
        { current: value => ['peynirli', 'tavuklu', 'etli'].includes(value), next: value => ['makarna', 'makarnasi', 'borek'].includes(value) },
        { current: value => ['hasasli', 'hashasli', 'hashashli'].includes(value), next: value => value === 'revani' },
        { current: value => value === 'kiy patates', next: value => value === 'oturtma' },
        { current: value => value === 'biber', next: value => value === 'dolma' },
        { current: value => value === 'patlican', next: value => value === 'musakka' },
        { current: value => value === 'tavuk', next: value => ['sote', 'but'].includes(value) },
        { current: value => value === 'cordon', next: value => ['blue', 'bleu'].includes(value) },
        { current: value => ['irmik', 'sut'].includes(value), next: value => value === 'helvasi' },
        { current: value => value === 'meyveli', next: value => value === 'kup' }
    ];

    return pairRules.some(rule => rule.current(normalizedCurrent) && rule.next(normalizedNext));
};

const mergeMealItemFragments = (items) => {
    const merged = [];

    for (const item of items) {
        const cleanItem = cleanMealItem(item);
        if (!cleanItem) continue;

        const previousIndex = merged.length - 1;
        const previous = merged[previousIndex];
        if (previous && shouldJoinWithNext(previous, cleanItem)) {
            merged[previousIndex] = cleanMealItem(`${previous} ${cleanItem}`);
        } else {
            merged.push(cleanItem);
        }
    }

    return merged;
};

const groupByCloseValue = (items, readValue, tolerance) => {
    const groups = [];
    for (const item of items) {
        const value = readValue(item);
        const group = groups.find(existing => Math.abs(existing.value - value) <= tolerance);
        if (group) {
            group.items.push(item);
            group.value = group.items.reduce((sum, current) => sum + readValue(current), 0) / group.items.length;
        } else {
            groups.push({ value, items: [item] });
        }
    }
    return groups;
};

const extractPositionedPdfItems = async (buffer) => {
    const document = await pdfjs.getDocument({ data: buffer }).promise;
    const items = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        const viewport = page.getViewport(1);

        for (const item of content.items || []) {
            const text = String(item.str || '').replace(/\s+/g, ' ').trim();
            if (!text) continue;
            items.push({
                text,
                normalized: normalizeText(text),
                x: item.transform[4],
                y: item.transform[5],
                page: pageNumber,
                pageWidth: viewport.width
            });
        }
    }

    return items;
};

const parsePositionedMenuItems = (pdfItems, monthValue) => {
    const dayMarkers = pdfItems
        .filter(item => /^\d{1,2}$/.test(item.text))
        .map(item => ({ ...item, day: Number(item.text) }))
        .filter(item => getDateForDay(monthValue, item.day));

    if (dayMarkers.length === 0) return [];

    const rowGroups = groupByCloseValue(dayMarkers, item => item.y, 10)
        .sort((a, b) => b.value - a.value)
        .map(group => ({
            y: group.value,
            markers: group.items.sort((a, b) => a.x - b.x)
        }));

    const menus = [];

    for (let rowIndex = 0; rowIndex < rowGroups.length; rowIndex++) {
        const row = rowGroups[rowIndex];
        const nextRow = rowGroups[rowIndex + 1];
        const rowTop = row.y + 8;
        const rowBottom = nextRow ? nextRow.y + 1 : -Infinity;

        for (let markerIndex = 0; markerIndex < row.markers.length; markerIndex++) {
            const marker = row.markers[markerIndex];
            const previous = row.markers[markerIndex - 1];
            const next = row.markers[markerIndex + 1];
            const left = previous ? (previous.x + marker.x) / 2 : marker.x - 8;
            const right = next ? (marker.x + next.x) / 2 : marker.pageWidth + 8;

            const cellItems = pdfItems
                .filter(item => (
                    item.page === marker.page &&
                    item.y < rowTop &&
                    item.y > rowBottom &&
                    item.x >= left &&
                    item.x < right &&
                    item !== marker
                ))
                .filter(item => {
                    if (/^\d{1,2}$/.test(item.text)) return false;
                    if (IGNORED_LINES.has(item.normalized)) return false;
                    if (MONTH_NAMES.includes(item.normalized)) return false;
                    return item.text.length > 1;
                });

            const lineGroups = groupByCloseValue(cellItems, item => item.y, 4)
                .sort((a, b) => b.value - a.value)
                .map(group => group.items.sort((a, b) => a.x - b.x).map(item => item.text).join(' ').trim())
                .map(line => line.replace(/\s+/g, ' '))
                .filter(Boolean);

            if (lineGroups.length) {
                menus.push({
                    meal_date: getDateForDay(monthValue, marker.day),
                    items: splitItems(lineGroups)
                });
            }
        }
    }

    return menus.sort((a, b) => a.meal_date.localeCompare(b.meal_date));
};

const formatMealDate = (value) => {
    if (!value) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
};

const parseMenuText = (text, monthValue) => {
    const menus = [];
    let current = null;

    const lines = String(text || '')
        .replace(/\r/g, '\n')
        .split('\n')
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean);

    for (const line of lines) {
        const normalized = normalizeText(line);
        if (!normalized || MONTH_NAMES.includes(normalized) || IGNORED_LINES.has(normalized)) continue;

        const dayMatch = line.match(/^(\d{1,2})(?:\s+|$)(.*)$/);
        if (dayMatch) {
            if (current && current.items.length) menus.push({ ...current, items: splitItems(current.items) });
            const mealDate = getDateForDay(monthValue, Number(dayMatch[1]));
            current = mealDate ? { meal_date: mealDate, items: [] } : null;
            const rest = dayMatch[2]?.trim();
            if (current && rest) current.items.push(rest);
            continue;
        }

        if (current && !/^\d+$/.test(line)) {
            current.items.push(line);
        }
    }

    if (current && current.items.length) menus.push({ ...current, items: splitItems(current.items) });
    return menus;
};

const mapRow = (row) => ({
    ...row,
    meal_date: formatMealDate(row.meal_date),
    items: splitItems(row.items)
});

async function parseMealMenuPdf(buffer, month) {
    const [result, positionedItems] = await Promise.all([
        pdfParse(buffer),
        extractPositionedPdfItems(buffer).catch(() => [])
    ]);
    const positionedMenus = parsePositionedMenuItems(positionedItems, month);
    const textMenus = parseMenuText(result.text, month);
    const usePositionedParser = positionedMenus.length >= textMenus.length;
    return {
        rawText: result.text,
        parser: usePositionedParser ? 'table' : 'text',
        menus: usePositionedParser ? positionedMenus : textMenus
    };
}

module.exports = {
    getTodayIso,
    getNextMonthStart,
    splitItems,
    formatMealDate,
    mapRow,
    parseMealMenuPdf
};
