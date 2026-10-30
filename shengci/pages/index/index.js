const store = require('../../utils/store');
const time = require('../../utils/time');

const SEEDS = ['出生', '上学第一天', '第一次出远门', '毕业', '第一份工作'];

// 把一条原始事件加工成时间轴能直接渲染的形状。
// 卡片形态随内容自动变化，否则时间轴会退化成同质列表。
function decorate(birth, event) {
    const photos = event.photos || [];
    const milestoneLike = event.type === 'milestone' || event.type === 'first' || event.type === 'last';

    let cardType = 'plain';
    if (photos.length > 0) cardType = 'photo';
    else if (milestoneLike) cardType = 'milestone';
    else if (event.content) cardType = 'quote';

    return {
        id: event.id,
        title: event.title || '未命名',
        dateLabel: time.formatShort(event.precision, event.value),
        excerpt: event.content ? event.content.slice(0, 54) : '',
        cover: photos.length > 0 ? photos[0] : '',
        photoCount: photos.length,
        place: event.place || '',
        cardType: cardType,
    };
}

// 按年分组。sortKey < 0（记不清的日子）单独成组并沉到最底部。
function buildGroups(birth, events) {
    const groups = [];
    let current = null;

    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const key = event.sortKey < 0 ? 'unknown' : String(Math.floor(event.sortKey / 10000));

        if (!current || current.key !== key) {
            let label = '';
            let ageLabel = '';
            if (key === 'unknown') {
                label = '记不清的日子';
            } else {
                const year = Number(key);
                label = String(year);
                const age = time.ageAt(birth, new Date(year, 6, 1));
                if (age && age.before) ageLabel = '出生前';
                else if (age) ageLabel = age.years === 0 ? '出生那年' : age.years + ' 岁';
            }
            current = { key: key, label: label, ageLabel: ageLabel, year: key === 'unknown' ? 0 : Number(key), allDecade: true, events: [] };
            groups.push(current);
        }

        if (event.precision !== 'decade') current.allDecade = false;
        current.events.push(decorate(birth, event));
    }

    // 整组都是"只记得大概十年"时，标题改成年代而不是具体年份
    for (let i = 0; i < groups.length; i++) {
        if (groups[i].allDecade && groups[i].key !== 'unknown') {
            groups[i].label = groups[i].label + ' 年代';
        }
        delete groups[i].allDecade;
    }

    return groups;
}

Page({
    data: {
        viewState: 'loading',
        mode: 'river',
        groups: [],
        stats: { recordCount: 0, daysAlive: 0, years: 0 },
        grid: { cells: [], passed: 0, total: 900, recordedCount: 0, years: 0 },
        seeds: SEEDS,
        draftHint: false,
        birthLabel: '',
    },

    onShow() {
        this.load();
    },

    load() {
        const profile = store.getProfile();
        if (!profile || !profile.birthDate) {
            wx.redirectTo({ url: '/pages/onboarding/onboarding' });
            return;
        }

        try {
            const birth = profile.birthDate;
            const events = store.listEvents();
            const daysAlive = time.daysBetween(birth);
            const draft = store.getDraft();

            this.setData({
                viewState: events.length > 0 ? 'ready' : 'empty',
                groups: buildGroups(birth, events),
                stats: {
                    recordCount: events.length,
                    daysAlive: daysAlive,
                    years: Math.floor(daysAlive / 365.25),
                },
                grid: time.buildLifeGrid(birth, events),
                draftHint: !!(draft && (draft.title || (draft.photos && draft.photos.length))),
                birthLabel: time.formatDate('day', birth),
            });
        } catch (e) {
            this.setData({ viewState: 'error' });
        }
    },

    switchMode(event) {
        const mode = event.currentTarget.dataset.mode;
        if (mode === this.data.mode) return;
        this.setData({ mode: mode });
    },

    openDetail(event) {
        wx.navigateTo({
            url: '/pages/event-detail/event-detail?id=' + event.currentTarget.dataset.id,
        });
    },

    goCreate() {
        wx.navigateTo({ url: '/pages/event-edit/event-edit' });
    },

    goAlbum() {
        wx.navigateTo({ url: '/pages/album/album' });
    },

    openRecap(event) {
        const year = Number(event.currentTarget.dataset.year);
        if (!year) return;
        wx.navigateTo({ url: '/pages/recap/recap?year=' + year });
    },

    createFromSeed(event) {
        const title = event.currentTarget.dataset.title;
        wx.navigateTo({
            url: '/pages/event-edit/event-edit?seed=' + encodeURIComponent(title),
        });
    },

    resumeDraft() {
        wx.navigateTo({ url: '/pages/event-edit/event-edit?draft=1' });
    },

    handleRetry() {
        this.setData({ viewState: 'loading' });
        this.load();
    },

    editBirth() {
        wx.navigateTo({ url: '/pages/onboarding/onboarding?edit=1' });
    },

    onPullDownRefresh() {
        this.load();
        wx.stopPullDownRefresh();
    },
});
