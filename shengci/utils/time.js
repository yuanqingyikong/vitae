// 「此生」时间层
// 设计要点：不把时间当作单一 Date 处理。
// 童年记忆精度天然不足（"大概三四岁""那年夏天"），
// 因此每个时间都由 precision（精度）+ value（字面值）两部分表达，
// 再用 approxDate() 投影成一个可比较的近似日期，用于排序 / 年龄 / 人生格定位。

const SEASON_LABEL = ['春', '夏', '秋', '冬'];

// 季节 -> 该季中间月的下标。春=4月中 / 夏=7月中 / 秋=10月中 / 冬=12月中
// 冬跨年，取当年 12 月作为锚点，保证同一年内的季节事件排序稳定。
const SEASON_MID_MONTH = [3, 6, 9, 11];

function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
}

// 季节字面值形如 "2019-S2"，取出 1..4；非法返回 0。
function seasonIndexOf(value) {
    const parts = String(value).split('-S');
    const n = Number(parts[1]);
    return n >= 1 && n <= 4 ? n : 0;
}

// 把模糊时间投影为近似日期。精度越粗，投影点越靠近该区间的中位。
function approxDate(precision, value) {
    if (!value) return null;
    const y = Number(value.slice(0, 4));
    if (!y) return null;

    if (precision === 'day') {
        const p = value.split('-');
        if (p.length < 3) return null;
        return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    }
    if (precision === 'month') {
        const p = value.split('-');
        if (p.length < 2) return null;
        return new Date(Number(p[0]), Number(p[1]) - 1, 15);
    }
    if (precision === 'season') {
        const s = seasonIndexOf(value);
        if (!s) return null;
        return new Date(y, SEASON_MID_MONTH[s - 1], 15);
    }
    if (precision === 'year') {
        return new Date(y, 6, 1);
    }
    if (precision === 'decade') {
        return new Date(y, 0, 1);
    }
    return null;
}

// 排序键：YYYYMMDD 形态的整数；unknown 记为 -1，排在最后（不占时间轴精确位置）
function buildSortKey(precision, value) {
    const d = approxDate(precision, value);
    if (!d) return -1;
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

// 完整中文表述，用于详情页
function formatDate(precision, value) {
    if (!value) return '记不清的日子';
    const y = value.slice(0, 4);
    if (precision === 'day') {
        const p = value.split('-');
        return y + '年' + Number(p[1]) + '月' + Number(p[2]) + '日';
    }
    if (precision === 'month') {
        const p = value.split('-');
        return y + '年' + Number(p[1]) + '月';
    }
    if (precision === 'year') return y + '年';
    if (precision === 'season') return y + '年' + SEASON_LABEL[seasonIndexOf(value) - 1];
    if (precision === 'decade') return y + '年代';
    return '记不清的日子';
}

// 紧凑表述，用于时间轴卡片
function formatShort(precision, value) {
    if (!value) return '不知何时';
    const y = value.slice(0, 4);
    if (precision === 'day') {
        const p = value.split('-');
        return p[0] + '.' + pad2(Number(p[1])) + '.' + pad2(Number(p[2]));
    }
    if (precision === 'month') {
        const p = value.split('-');
        return p[0] + '.' + pad2(Number(p[1]));
    }
    if (precision === 'year') return y;
    if (precision === 'season') return y + ' ' + SEASON_LABEL[seasonIndexOf(value) - 1];
    if (precision === 'decade') return y + 's';
    return '不知何时';
}

// 精度越粗，年龄表述越保守（加"约"）
function isCoarse(precision) {
    return precision === 'year' || precision === 'season' || precision === 'decade' || precision === 'unknown';
}

function ageAt(birthISO, date) {
    if (!birthISO || !date) return null;
    const b = new Date(birthISO);
    if (isNaN(b.getTime())) return null;
    let months = (date.getFullYear() - b.getFullYear()) * 12 + (date.getMonth() - b.getMonth());
    if (date.getDate() < b.getDate()) months -= 1;
    if (months < 0) return { years: 0, months: 0, before: true };
    const years = Math.floor(months / 12);
    return { years: years, months: months % 12 };
}

function ageLabel(birthISO, precision, value) {
    const d = approxDate(precision, value);
    if (!d) return '';
    const a = ageAt(birthISO, d);
    if (!a) return '';
    if (a.before) return '出生前';
    const coarse = isCoarse(precision);
    const prefix = coarse ? '约 ' : '';
    if (a.years === 0 && a.months === 0) return '刚出生';
    if (a.years === 0) return prefix + a.months + ' 个月';
    if (!coarse && a.months > 0) return prefix + a.years + ' 岁 ' + a.months + ' 个月';
    return prefix + a.years + ' 岁';
}

function daysBetween(from, to) {
    const a = new Date(from);
    const b = to || new Date();
    if (isNaN(a.getTime())) return 0;
    return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function monthsBetween(birthISO, date) {
    const b = new Date(birthISO);
    return (date.getFullYear() - b.getFullYear()) * 12 + (date.getMonth() - b.getMonth());
}

// 人生格：75 年 × 12 月 = 900 格，一格一月
const LIFE_TOTAL_MONTHS = 900;

function buildLifeGrid(birthISO, events) {
    const now = new Date();
    let passed = monthsBetween(birthISO, now);
    if (passed < 0) passed = 0;
    if (passed > LIFE_TOTAL_MONTHS) passed = LIFE_TOTAL_MONTHS;

    const recorded = {};
    (events || []).forEach(function (e) {
        const d = approxDate(e.precision, e.value);
        if (!d) return;
        const m = monthsBetween(birthISO, d);
        if (m >= 0 && m < LIFE_TOTAL_MONTHS) recorded[m] = true;
    });

    const cells = [];
    for (let i = 0; i < LIFE_TOTAL_MONTHS; i++) {
        if (i >= passed) cells.push(0);
        else if (recorded[i]) cells.push(2);
        else cells.push(1);
    }

    return {
        cells: cells,
        passed: passed,
        total: LIFE_TOTAL_MONTHS,
        recordedCount: Object.keys(recorded).length,
        years: Math.floor(passed / 12)
    };
}

module.exports = {
    SEASON_LABEL: SEASON_LABEL,
    LIFE_TOTAL_MONTHS: LIFE_TOTAL_MONTHS,
    approxDate: approxDate,
    buildSortKey: buildSortKey,
    formatDate: formatDate,
    formatShort: formatShort,
    ageAt: ageAt,
    ageLabel: ageLabel,
    daysBetween: daysBetween,
    monthsBetween: monthsBetween,
    buildLifeGrid: buildLifeGrid
};
