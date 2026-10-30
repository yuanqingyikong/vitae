const store = require('../../utils/store');
const time = require('../../utils/time');
const { typeLabel } = require('../../utils/constants');

Page({
    data: {
        viewState: 'loading',
        id: '',
        title: '',
        dateLabel: '',
        ageLabel: '',
        typeLabel: '',
        emotion: '',
        place: '',
        content: '',
        photos: [],
        single: false,
    },

    onLoad(options) {
        this.setData({ id: options && options.id ? options.id : '' });
    },

    onShow() {
        this.load();
    },

    load() {
        const profile = store.getProfile();
        const birth = profile && profile.birthDate ? profile.birthDate : '';
        const event = this.data.id ? store.getEvent(this.data.id) : null;

        if (!event) {
            this.setData({ viewState: 'missing' });
            return;
        }

        const photos = event.photos || [];

        this.setData({
            viewState: 'ready',
            title: event.title || '未命名',
            dateLabel: time.formatDate(event.precision, event.value),
            ageLabel: birth ? time.ageLabel(birth, event.precision, event.value) : '',
            typeLabel: typeLabel(event.type),
            emotion: event.emotion || '',
            place: event.place || '',
            content: event.content || '',
            photos: photos,
            single: photos.length === 1,
        });
    },

    preview(event) {
        wx.previewImage({
            current: event.currentTarget.dataset.src,
            urls: this.data.photos,
        });
    },

    edit() {
        wx.navigateTo({ url: '/pages/event-edit/event-edit?id=' + this.data.id });
    },

    remove() {
        const self = this;
        wx.showModal({
            title: '删除这条记录',
            content: '删掉就找不回来了。确定吗？',
            confirmText: '删除',
            confirmColor: '#993c1d',
            success(res) {
                if (!res.confirm) return;
                store.removeEvent(self.data.id);
                wx.navigateBack();
            },
        });
    },
});
