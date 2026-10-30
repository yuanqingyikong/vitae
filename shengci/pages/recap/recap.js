const store = require('../../utils/store');
const time = require('../../utils/time');

const TYPE_PRIORITY = {
    milestone: 0,
    first: 1,
    last: 2,
    turn: 3,
    gather: 4,
    farewell: 5,
    daily: 6,
};

function ellipsize(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 0 && ctx.measureText(t + '…').width > maxWidth) {
        t = t.slice(0, -1);
    }
    return t + '…';
}

function wrapLines(ctx, text, maxWidth, maxLines) {
    const lines = [];
    let rest = text;
    while (rest.length > 0 && lines.length < maxLines) {
        if (ctx.measureText(rest).width <= maxWidth) {
            lines.push(rest);
            rest = '';
            break;
        }
        let cut = rest.length;
        while (cut > 0 && ctx.measureText(rest.slice(0, cut)).width > maxWidth) cut--;
        if (cut <= 0) break;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
    }
    if (rest.length > 0 && lines.length > 0) {
        const lastIndex = lines.length - 1;
        lines[lastIndex] = ellipsize(ctx, lines[lastIndex] + rest, maxWidth);
    }
    return lines;
}

Page({
    data: {
        years: [],
        yearIndex: 0,
        year: 0,
        empty: true,
        ready: false,
    },

    onLoad(options) {
        const events = store.listEvents();
        const years = [];

        events.forEach(function (e) {
            if (e.sortKey > 0) {
                const y = Math.floor(e.sortKey / 10000);
                if (years.indexOf(y) < 0) years.push(y);
            }
        });

        years.sort(function (a, b) {
            return b - a;
        });

        if (years.length === 0) years.push(new Date().getFullYear());

        let yearIndex = 0;
        if (options && options.year) {
            const wanted = Number(options.year);
            for (let i = 0; i < years.length; i++) {
                if (years[i] === wanted) {
                    yearIndex = i;
                    break;
                }
            }
        }

        this.setData({ years: years, yearIndex: yearIndex, year: years[yearIndex] }, () => {
            this.compute();
        });
    },

    onReady() {
        this.initCanvas();
    },

    onYearChange(event) {
        const index = Number(event.detail.value);
        this.setData({ yearIndex: index, year: this.data.years[index] }, () => {
            this.compute();
        });
    },

    compute() {
        const events = store.listEvents();
        const year = this.data.year;
        const profile = store.getProfile();
        const birth = profile && profile.birthDate ? profile.birthDate : '';

        const inYear = events.filter(function (e) {
            return e.sortKey > 0 && Math.floor(e.sortKey / 10000) === year;
        });

        let photoCount = 0;
        const months = [];
        for (let i = 0; i < 12; i++) months.push(false);
        const places = {};

        inYear.forEach(function (e) {
            photoCount += (e.photos || []).length;
            const d = time.approxDate(e.precision, e.value);
            if (d) months[d.getMonth()] = true;
            if (e.place) places[e.place] = true;
        });

        const picked = inYear.slice().sort(function (a, b) {
            const pa = TYPE_PRIORITY[a.type] === undefined ? 9 : TYPE_PRIORITY[a.type];
            const pb = TYPE_PRIORITY[b.type] === undefined ? 9 : TYPE_PRIORITY[b.type];
            if (pa !== pb) return pa - pb;
            return b.sortKey - a.sortKey;
        });

        const top = picked.slice(0, 3).map(function (e) {
            return {
                title: e.title || '未命名',
                date: time.formatShort(e.precision, e.value),
            };
        });

        const withContent = inYear
            .filter(function (e) {
                return e.content && e.content.length > 8;
            })
            .sort(function (a, b) {
                return b.content.length - a.content.length;
            });

        let ageLabel = '';
        if (birth) {
            const diff = year - Number(birth.slice(0, 4));
            ageLabel = diff > 0 ? diff + ' 岁' : '出生那年';
        }

        this.stats = {
            count: inYear.length,
            photos: photoCount,
            cities: Object.keys(places).length,
            months: months,
            top: top,
            quote: withContent.length > 0 ? withContent[0].content : '',
            ageLabel: ageLabel,
        };

        this.setData({ empty: inYear.length === 0 });
        this.draw();
    },

    initCanvas() {
        const query = wx.createSelectorQuery().in(this);
        query
            .select('#card')
            .fields({ node: true, size: true })
            .exec((res) => {
                const info = res && res[0];
                if (!info || !info.node) return;

                const canvas = info.node;
                const dpr = (wx.getSystemInfoSync().pixelRatio) || 2;

                canvas.width = info.width * dpr;
                canvas.height = info.height * dpr;

                const ctx = canvas.getContext('2d');
                ctx.scale(dpr, dpr);

                this.canvas = canvas;
                this.ctx = ctx;
                this.dpr = dpr;
                this.cardW = info.width;
                this.cardH = info.height;

                this.setData({ ready: true });
                this.draw();
            });
    },

    draw() {
        const ctx = this.ctx;
        if (!ctx || !this.stats) return;

        const W = this.cardW;
        const H = this.cardH;
        const pad = Math.round(W * 0.088);
        const inner = W - pad * 2;
        const s = this.stats;

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#faf8f4';
        ctx.fillRect(0, 0, W, H);

        // 顶部细线
        ctx.strokeStyle = '#e6e0d4';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad, pad);
        ctx.lineTo(W - pad, pad);
        ctx.stroke();

        // 题头
        ctx.fillStyle = '#b8b2a8';
        ctx.font = Math.round(W * 0.036) + 'px serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('此 生', pad, pad + W * 0.075);

        ctx.textAlign = 'right';
        ctx.fillText('一年', W - pad, pad + W * 0.075);

        // 年份
        ctx.textAlign = 'left';
        ctx.fillStyle = '#2c2c2a';
        ctx.font = Math.round(W * 0.2) + 'px serif';
        ctx.fillText(String(this.data.year), pad - 2, pad + W * 0.32);

        // 年龄
        if (s.ageLabel) {
            ctx.fillStyle = '#a8a29a';
            ctx.font = Math.round(W * 0.042) + 'px serif';
            ctx.fillText(s.ageLabel, pad, pad + W * 0.395);
        }

        // 分隔线
        const hrY = pad + W * 0.46;
        ctx.strokeStyle = '#e6e0d4';
        ctx.beginPath();
        ctx.moveTo(pad, hrY);
        ctx.lineTo(W - pad, hrY);
        ctx.stroke();

        // 统计
        ctx.fillStyle = '#5f5e5a';
        ctx.font = Math.round(W * 0.046) + 'px serif';
        const statLine = s.count + ' 件事 · ' + s.photos + ' 张照片 · ' + s.cities + ' 座城';
        ctx.fillText(ellipsize(ctx, statLine, inner), pad, hrY + W * 0.1);

        // 月份条：12 格，有记录的那几个月点亮
        const gap = Math.max(3, Math.round(W * 0.008));
        const cellW = (inner - gap * 11) / 12;
        const cellH = cellW * 1.5;
        const barY = hrY + W * 0.15;

        for (let i = 0; i < 12; i++) {
            ctx.fillStyle = s.months[i] ? '#993c1d' : '#e6e0d4';
            ctx.fillRect(pad + i * (cellW + gap), barY, cellW, cellH);
        }

        // 事件条目：有引言时只放 2 条，否则 3 条
        // （3 条事件 + 2 行引言会重叠，见 draw 的布局约束）
        let y = barY + cellH + W * 0.11;
        const dateW = Math.round(W * 0.2);
        const items = s.quote ? s.top.slice(0, 2) : s.top.slice(0, 3);

        if (s.top.length === 0) {
            ctx.fillStyle = '#c3bdb2';
            ctx.font = Math.round(W * 0.042) + 'px serif';
            ctx.fillText('这一年，没有留下记录。', pad, y + W * 0.05);
            y += W * 0.1;
        }

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            ctx.fillStyle = '#b8b2a8';
            ctx.font = Math.round(W * 0.036) + 'px serif';
            ctx.fillText(item.date, pad, y);

            ctx.fillStyle = '#2c2c2a';
            ctx.font = Math.round(W * 0.05) + 'px serif';
            ctx.fillText(ellipsize(ctx, item.title, inner - dateW), pad + dateW, y);

            y += W * 0.095;
        }

        // 一句话：优先贴底，但与事件区之间必须留出间距；放不下就不放
        if (s.quote) {
            const lineH = W * 0.072;
            ctx.fillStyle = '#7a5a3a';
            ctx.font = Math.round(W * 0.042) + 'px serif';

            const lines = wrapLines(ctx, s.quote, inner - W * 0.03, 2);
            const preferred = H - pad - W * 0.2;
            const quoteTop = Math.max(y + W * 0.04, preferred);
            const bottomLimit = H - pad * 1.7;

            if (quoteTop + (lines.length - 1) * lineH <= bottomLimit) {
                for (let i = 0; i < lines.length; i++) {
                    ctx.fillText(lines[i], pad + W * 0.03, quoteTop + i * lineH);
                }

                ctx.strokeStyle = '#ddd6c8';
                ctx.beginPath();
                ctx.moveTo(pad, quoteTop - W * 0.06);
                ctx.lineTo(pad, quoteTop + (lines.length - 1) * lineH + W * 0.015);
                ctx.stroke();
            }
        }

        // 页脚
        ctx.fillStyle = '#c3bdb2';
        ctx.font = Math.round(W * 0.034) + 'px serif';
        ctx.textAlign = 'right';
        ctx.fillText('此生 · 一个人的编年史', W - pad, H - pad * 0.7);
        ctx.textAlign = 'left';
    },

    save() {
        if (!this.canvas) {
            wx.showToast({ title: '卡片还没准备好', icon: 'none' });
            return;
        }

        wx.canvasToTempFilePath(
            {
                canvas: this.canvas,
                success: (res) => {
                    this.writeToAlbum(res.tempFilePath);
                },
                fail: () => {
                    wx.showToast({ title: '生成图片失败', icon: 'none' });
                },
            },
            this
        );
    },

    writeToAlbum(filePath) {
        wx.saveImageToPhotosAlbum({
            filePath: filePath,
            success: () => {
                wx.showToast({ title: '已保存到相册' });
            },
            fail: (err) => {
                const msg = (err && err.errMsg) || '';
                if (msg.indexOf('auth') >= 0 || msg.indexOf('deny') >= 0) {
                    wx.showModal({
                        title: '需要相册权限',
                        content: '保存图片需要你允许写入相册。',
                        confirmText: '去设置',
                        success: (res) => {
                            if (res.confirm) wx.openSetting();
                        },
                    });
                    return;
                }
                wx.showToast({ title: '保存未完成', icon: 'none' });
            },
        });
    },
});
