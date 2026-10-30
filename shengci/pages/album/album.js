const store = require('../../utils/store');
const time = require('../../utils/time');
const { typeLabel } = require('../../utils/constants');

const FACETS = [
    { code: 'year', label: '按年份' },
    { code: 'place', label: '按地点' },
    { code: 'type', label: '按类型' },
];

Page({
    data: {
        viewState: 'loading',
        facets: FACETS,
        facet: 'year',
        sections: [],
        total: 0,
    },

    onShow() {
        this.load();
    },

    // 照片不是独立实体，它挂在事件上。相册是同一个数据集的一个切面。
    load() {
        try {
            const events = store.listEvents();
            const items = [];

            events.forEach(function (event) {
                const photos = event.photos || [];
                photos.forEach(function (path) {
                    items.push({
                        path: path,
                        eventId: event.id,
                        title: event.title || '未命名',
                        dateLabel: time.formatShort(event.precision, event.value),
                        year: event.sortKey > 0 ? String(Math.floor(event.sortKey / 10000)) : '未知',
                        place: event.place || '未标注地点',
                        type: typeLabel(event.type) || '未分类',
                    });
                });
            });

            if (items.length === 0) {
                this.items = [];
                this.setData({ viewState: 'empty', total: 0, sections: [] });
                return;
            }

            this.items = items;
            this.setData({ total: items.length });
            this.rebuild(this.data.facet);
        } catch (e) {
            this.setData({ viewState: 'empty', total: 0, sections: [] });
        }
    },

    rebuild(facet) {
        if (!this.items || this.items.length === 0) return;

        const groups = {};
        const order = [];

        this.items.forEach(function (item) {
            let key;
            let title;
            if (facet === 'year') {
                key = item.year;
                title = item.year === '未知' ? '记不清的年份' : item.year + ' 年';
            } else if (facet === 'place') {
                key = item.place;
                title = item.place;
            } else {
                key = item.type;
                title = item.type;
            }

            if (!groups[key]) {
                groups[key] = { key: key, title: title, photos: [] };
                order.push(key);
            }
            groups[key].photos.push(item);
        });

        const sections = order.map(function (k) {
            return groups[k];
        });

        if (facet === 'year') {
            // 年份倒序，"未知"沉底
            sections.sort(function (a, b) {
                const av = a.key === '未知' ? -1 : Number(a.key);
                const bv = b.key === '未知' ? -1 : Number(b.key);
                return bv - av;
            });
        } else {
            // 地点 / 类型按张数倒序，密度高的先看到
            sections.sort(function (a, b) {
                return b.photos.length - a.photos.length;
            });
        }

        sections.forEach(function (s) {
            s.subtitle = s.photos.length + ' 张';
        });

        this.setData({ viewState: 'ready', sections: sections });
    },

    switchFacet(event) {
        const code = event.currentTarget.dataset.code;
        if (code === this.data.facet) return;
        this.setData({ facet: code });
        this.rebuild(code);
    },

    preview(event) {
        const si = Number(event.currentTarget.dataset.si);
        const pi = Number(event.currentTarget.dataset.pi);
        const section = this.data.sections[si];
        if (!section) return;

        const urls = section.photos.map(function (p) {
            return p.path;
        });

        wx.previewImage({
            current: urls[pi],
            urls: urls,
        });
    },

    goCreate() {
        wx.navigateTo({ url: '/pages/event-edit/event-edit' });
    },
});
