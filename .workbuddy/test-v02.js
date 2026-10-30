// v0.2 逻辑验证：相册切面分组 + 年度卡片绘制边界
// 用假的 wx / canvas context 驱动真实页面代码，检查分组结果与绘制坐标。

const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'shengci');

// ---------- 假数据 ----------
const EVENTS = [
    { id: 'a', title: '第一次见到海', precision: 'day', value: '2019-07-14', sortKey: 20190714, type: 'first', place: '青岛', content: '那天的风很大，我一直记得咸味。后来很多年没有再回去过。', photos: ['p1.jpg', 'p2.jpg'] },
    { id: 'b', title: '搬进新家', precision: 'day', value: '2019-11-02', sortKey: 20191102, type: 'daily', place: '北京', content: '', photos: ['p3.jpg'] },
    { id: 'e', title: '拿到毕业证', precision: 'day', value: '2019-06-20', sortKey: 20190620, type: 'milestone', place: '', content: '', photos: [] },
    { id: 'c', title: '上大学', precision: 'season', value: '2016-S1', sortKey: 20160415, type: 'milestone', place: '', content: '', photos: ['p4.jpg', 'p5.jpg', 'p6.jpg'] },
    { id: 'f1', title: '换了学校', precision: 'day', value: '2015-01-05', sortKey: 20150105, type: 'turn', place: '', content: '', photos: [] },
    { id: 'f2', title: '学会骑车', precision: 'day', value: '2015-04-11', sortKey: 20150411, type: 'first', place: '', content: '', photos: [] },
    { id: 'f3', title: '养了一只猫', precision: 'day', value: '2015-09-09', sortKey: 20150909, type: 'daily', place: '', content: '', photos: [] },
    { id: 'd', title: '记不清的一件事', precision: 'unknown', value: '', sortKey: -1, type: 'daily', place: '', content: '', photos: ['p7.jpg'] },
];

// ---------- 假 wx ----------
global.wx = {
    getStorageSync(key) {
        if (key === 'sc_events') return EVENTS;
        if (key === 'sc_profile') return { birthDate: '1995-06-15' };
        return '';
    },
    setStorageSync() {},
    removeStorageSync() {},
    getFileSystemManager() {
        return { accessSync() {}, mkdirSync() {}, copyFileSync() {} };
    },
    env: { USER_DATA_PATH: '/tmp' },
    createSelectorQuery() {
        return { in() { return this; }, select() { return this; }, fields() { return this; }, exec() {} };
    },
    getSystemInfoSync() {
        return { pixelRatio: 2, windowWidth: 375 };
    },
};

// ---------- 加载页面 ----------
let captured = null;
global.Page = function (cfg) {
    captured = cfg;
};

function loadPage(relPath) {
    captured = null;
    delete require.cache[require.resolve(path.join(ROOT, relPath))];
    require(path.join(ROOT, relPath));
    return captured;
}

function instantiate(cfg) {
    const page = Object.assign({}, cfg);
    page.data = JSON.parse(JSON.stringify(cfg.data));
    page.setData = function (patch, cb) {
        Object.assign(this.data, patch);
        if (cb) cb();
    };
    return page;
}

let problems = 0;
function check(ok, label, detail) {
    if (!ok) {
        problems++;
        console.log('  ! ' + label + (detail ? ' → ' + detail : ''));
    } else {
        console.log('  ok ' + label + (detail ? ' → ' + detail : ''));
    }
}

// ================= 1. 相册切面 =================
console.log('\n[1] 相册切面分组');
const albumCfg = loadPage('pages/album/album.js');
const album = instantiate(albumCfg);
album.load();
check(album.data.total === 7, '照片总数 7', String(album.data.total));

function titles(page) {
    return page.data.sections.map(function (s) {
        return s.title + '(' + s.photos.length + ')';
    }).join(' | ');
}

check(true, '按年份', titles(album));
album.switchFacet({ currentTarget: { dataset: { code: 'place' } } });
check(album.data.facet === 'place', '切到按地点');
check(true, '按地点', titles(album));
album.switchFacet({ currentTarget: { dataset: { code: 'type' } } });
check(true, '按类型', titles(album));

const yearSections = (function () {
    album.switchFacet({ currentTarget: { dataset: { code: 'year' } } });
    return album.data.sections.map(function (s) { return s.key; });
})();
check(yearSections[0] === '2019', '年份倒序首位为 2019', yearSections.join(','));
check(yearSections[yearSections.length - 1] === '未知', '未知年份沉底', yearSections.join(','));

// ================= 2. 年度卡片 =================
console.log('\n[2] 年度回顾统计');
const recapCfg = loadPage('pages/recap/recap.js');
const recap = instantiate(recapCfg);
recap.data.year = 2019;
recap.data.years = [2019, 2016];
recap.compute();

const st = recap.stats;
check(st.count === 3, '2019 年事件数 3', String(st.count));
check(st.photos === 3, '2019 年照片数 3', String(st.photos));
check(st.cities === 2, '2019 年城市数 2', String(st.cities));
check(st.months[5] === true && st.months[6] === true && st.months[10] === true, '月份条 6/7/11 月点亮', JSON.stringify(st.months));
check(st.ageLabel === '24 岁', '年龄 24 岁', st.ageLabel);
check(st.top.length === 3, '候选事件 3 条', String(st.top.length));

console.log('\n[3] Canvas 绘制边界');
const W = 345;
const H = 500;

function makeCtx() {
    const calls = { text: [], rect: [], line: [] };
    let fontSize = 14;
    const ctx = {
        get font() {
            return fontSize + 'px serif';
        },
        set font(v) {
            const m = /(\d+(?:\.\d+)?)px/.exec(v);
            fontSize = m ? Number(m[1]) : 14;
        },
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        textAlign: 'left',
        textBaseline: 'alphabetic',
        measureText(t) {
            let w = 0;
            for (const ch of String(t)) {
                w += /[\u4e00-\u9fa5\uff00-\uffef]/.test(ch) ? fontSize : fontSize * 0.52;
            }
            return { width: w };
        },
        clearRect() {},
        fillRect(x, y, w, h) {
            calls.rect.push([x, y, w, h]);
        },
        strokeRect() {},
        beginPath() {},
        moveTo(x, y) {
            calls.line.push([x, y]);
        },
        lineTo(x, y) {
            calls.line.push([x, y]);
        },
        stroke() {},
        fillText(t, x, y) {
            calls.text.push([String(t), x, y]);
        },
        scale() {},
    };
    return { ctx, calls };
}

const { ctx, calls } = makeCtx();
recap.ctx = ctx;
recap.canvas = {};
recap.cardW = W;
recap.cardH = H;
recap.dpr = 2;
recap.draw();

let nanCount = 0;
let overflow = [];

calls.text.forEach(function (item) {
    const t = item[0];
    const x = item[1];
    const y = item[2];
    if (!isFinite(x) || !isFinite(y)) nanCount++;
    if (x < -2 || x > W + 2 || y < -2 || y > H + 2) overflow.push('text "' + t + '" @' + x.toFixed(1) + ',' + y.toFixed(1));
});
calls.rect.forEach(function (r) {
    if (r.some(function (v) { return !isFinite(v); })) nanCount++;
    if (r[0] < -2 || r[0] + r[2] > W + 2 || r[1] < -2 || r[1] + r[3] > H + 2) {
        overflow.push('rect @' + r.map(function (v) { return v.toFixed(1); }).join(','));
    }
});
calls.line.forEach(function (p) {
    if (!isFinite(p[0]) || !isFinite(p[1])) nanCount++;
    if (p[0] < -2 || p[0] > W + 2 || p[1] < -2 || p[1] > H + 2) overflow.push('line @' + p[0].toFixed(1) + ',' + p[1].toFixed(1));
});

check(nanCount === 0, '无 NaN 坐标', 'NaN 数 = ' + nanCount);
check(overflow.length === 0, '所有绘制元素在卡片边界内', overflow.length ? overflow.slice(0, 5).join(' ; ') : '边界 ' + W + '×' + H);
check(calls.text.length > 6, '有文字被绘制', calls.text.length + ' 次');

// 事件行与引言行不能重叠：有引言时应只放 2 条事件
const eventTitles = st.top.map(function (t) {
    return t.title;
});
const eventYs = calls.text
    .filter(function (t) { return eventTitles.indexOf(t[0]) >= 0; })
    .map(function (t) { return t[2]; });
const quoteYs = calls.text
    .filter(function (t) { return String(t[0]).length > 3 && st.quote.indexOf(String(t[0]).replace('…', '')) >= 0; })
    .map(function (t) { return t[2]; });

check(eventYs.length === 2, '有引言时事件只放 2 条', '实际 ' + eventYs.length + ' 条');
check(quoteYs.length >= 1, '引言已绘制', quoteYs.length + ' 行');

if (eventYs.length && quoteYs.length) {
    const maxEventY = Math.max.apply(null, eventYs);
    const minQuoteY = Math.min.apply(null, quoteYs);
    check(minQuoteY - maxEventY >= 10, '引言与最后一条事件不重叠', '事件末行 y=' + maxEventY.toFixed(1) + ' 引言首行 y=' + minQuoteY.toFixed(1) + ' 间距=' + (minQuoteY - maxEventY).toFixed(1));
}

console.log('\n  绘制文本清单:');
calls.text.forEach(function (t) {
    console.log('    "' + t[0] + '"  @ ' + t[1].toFixed(1) + ', ' + t[2].toFixed(1));
});

// ================= 4. 空年份 =================
console.log('\n[4] 无记录年份');
const recap2 = instantiate(recapCfg);
recap2.data.year = 2001;
recap2.compute();
const { ctx: ctx2, calls: calls2 } = makeCtx();
recap2.ctx = ctx2;
recap2.cardW = W;
recap2.cardH = H;
recap2.draw();
const hasEmptyHint = calls2.text.some(function (t) {
    return t[0].indexOf('没有留下记录') >= 0;
});
check(recap2.stats.count === 0, '空年份统计为 0', String(recap2.stats.count));
check(hasEmptyHint, '空年份卡片绘制了提示文案');
const nan2 = calls2.text.filter(function (t) { return !isFinite(t[1]) || !isFinite(t[2]); }).length;
check(nan2 === 0, '空年份无 NaN 坐标');

// ================= 5. 无引言年份 =================
console.log('\n[5] 无引言年份');
const recap3 = instantiate(recapCfg);
recap3.data.year = 2015;
recap3.compute();
const made3 = makeCtx();
recap3.ctx = made3.ctx;
recap3.cardW = W;
recap3.cardH = H;
recap3.draw();

const titles3 = recap3.stats.top.map(function (t) {
    return t.title;
});
const drawn3 = made3.calls.text.filter(function (t) {
    return titles3.indexOf(t[0]) >= 0;
}).map(function (t) { return t[2]; });

check(recap3.stats.quote === '', '该年无引言', JSON.stringify(recap3.stats.quote));
check(drawn3.length === 3, '无引言时事件放满 3 条', '实际 ' + drawn3.length + ' 条');
check(Math.max.apply(null, drawn3) < H - 40, '末条事件未压到页脚', 'y=' + Math.max.apply(null, drawn3).toFixed(1));
const over3 = made3.calls.text.filter(function (t) {
    return !isFinite(t[1]) || !isFinite(t[2]) || t[2] > H + 2 || t[1] < -2;
}).length;
check(over3 === 0, '该分支无越界/NaN', '异常 ' + over3);

console.log(problems === 0 ? '\n全部通过' : '\n共 ' + problems + ' 个问题');
process.exit(problems === 0 ? 0 : 1);
